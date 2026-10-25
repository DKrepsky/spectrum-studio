//! Local persistence of preferences and saved source configurations as versioned JSON files.
//!
//! Writes are atomic (temporary file + rename). Unreadable or invalid files are moved aside and
//! replaced by defaults, and a warning is reported instead of failing start-up.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::model::session::now_ms;
use crate::model::{ProcessingSettings, SourceConfig};

pub const PREFERENCES_FILE: &str = "preferences.json";
pub const SOURCES_FILE: &str = "sources.json";
pub const SCHEMA_VERSION: u32 = 1;
const MAX_NAME_LENGTH: usize = 80;
const MAX_SAVED_SOURCES: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Palette {
    #[default]
    Classic,
    Viridis,
    Grayscale,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct DisplayPreferences {
    pub reference_level: f64,
    pub range_db: f64,
    pub show_waterfall: bool,
    pub palette: Palette,
}

impl Default for DisplayPreferences {
    fn default() -> Self {
        Self {
            reference_level: 0.0,
            range_db: 120.0,
            show_waterfall: true,
            palette: Palette::Classic,
        }
    }
}

impl DisplayPreferences {
    pub fn validate(&self) -> Result<(), String> {
        if !(-200.0..=100.0).contains(&self.reference_level) {
            return Err("Reference level must be between -200 and 100.".into());
        }
        if !(10.0..=200.0).contains(&self.range_db) {
            return Err("Display range must be between 10 and 200 dB.".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct Preferences {
    pub version: u32,
    pub processing: ProcessingSettings,
    pub display: DisplayPreferences,
    /// Source selected when the application was last used (not connected automatically).
    pub last_source: Option<SourceConfig>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
            processing: ProcessingSettings::default(),
            display: DisplayPreferences::default(),
            last_source: None,
        }
    }
}

impl Preferences {
    pub fn validate(&self) -> Result<(), String> {
        self.processing.validate()?;
        self.display.validate()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SavedSource {
    pub id: String,
    pub name: String,
    pub config: SourceConfig,
    pub created_ms: f64,
    pub updated_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SavedSources {
    version: u32,
    sources: Vec<SavedSource>,
}

impl Default for SavedSources {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
            sources: Vec::new(),
        }
    }
}

impl SavedSources {
    fn validate(&self) -> Result<(), String> {
        for s in &self.sources {
            validate_name(&s.name)?;
        }
        Ok(())
    }
}

fn validate_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("A name is required.".into());
    }
    if trimmed.chars().count() > MAX_NAME_LENGTH {
        return Err(format!(
            "Names are limited to {MAX_NAME_LENGTH} characters."
        ));
    }
    Ok(())
}

/// Writes `value` as pretty JSON to `path` atomically.
pub fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(value).map_err(io::Error::other)?;
    fs::write(&tmp, json)?;
    fs::rename(&tmp, path)
}

/// Loads a JSON file. Missing → default. Corrupt or invalid → moved aside, default, warning.
fn load_or_default<T: DeserializeOwned + Default>(
    path: &Path,
    validate: impl Fn(&T) -> Result<(), String>,
) -> (T, Option<String>) {
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return (T::default(), None),
        Err(e) => {
            return (
                T::default(),
                Some(format!(
                    "Could not read {}: {e}. Defaults are used.",
                    path.display()
                )),
            );
        }
    };
    let problem = match serde_json::from_slice::<T>(&bytes) {
        Ok(value) => match validate(&value) {
            Ok(()) => return (value, None),
            Err(e) => e,
        },
        Err(e) => e.to_string(),
    };
    let backup = path.with_extension(format!("corrupt-{}.json", now_ms() as u64));
    let moved = fs::rename(path, &backup).is_ok();
    let warning = format!(
        "{} was invalid ({problem}) and has been reset to defaults.{}",
        path.display(),
        if moved {
            format!(" The old file was kept as {}.", backup.display())
        } else {
            String::new()
        }
    );
    (T::default(), Some(warning))
}

/// Thread-safe access to the persisted files in one configuration directory.
pub struct ConfigStore {
    dir: PathBuf,
    preferences: Mutex<Preferences>,
    sources: Mutex<SavedSources>,
    warnings: Vec<String>,
}

impl ConfigStore {
    pub fn open(dir: impl Into<PathBuf>) -> Self {
        let dir = dir.into();
        let (preferences, w1) =
            load_or_default::<Preferences>(&dir.join(PREFERENCES_FILE), Preferences::validate);
        let (sources, w2) =
            load_or_default::<SavedSources>(&dir.join(SOURCES_FILE), SavedSources::validate);
        Self {
            dir,
            preferences: Mutex::new(preferences),
            sources: Mutex::new(sources),
            warnings: w1.into_iter().chain(w2).collect(),
        }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Problems found while loading (corrupt files that were reset).
    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }

    pub fn preferences(&self) -> Preferences {
        lock(&self.preferences).clone()
    }

    /// Applies `change` to the preferences, validates and saves them.
    pub fn update_preferences(
        &self,
        change: impl FnOnce(&mut Preferences),
    ) -> Result<Preferences, String> {
        let mut guard = lock(&self.preferences);
        let mut next = guard.clone();
        change(&mut next);
        next.version = SCHEMA_VERSION;
        next.validate()?;
        write_json_atomic(&self.dir.join(PREFERENCES_FILE), &next)
            .map_err(|e| format!("Could not save preferences: {e}"))?;
        *guard = next.clone();
        Ok(next)
    }

    pub fn saved_sources(&self) -> Vec<SavedSource> {
        lock(&self.sources).sources.clone()
    }

    /// Creates a saved configuration, or updates the one with `id`.
    pub fn save_source(
        &self,
        id: Option<&str>,
        name: &str,
        config: SourceConfig,
    ) -> Result<SavedSource, String> {
        validate_name(name)?;
        let mut guard = lock(&self.sources);
        let mut next = guard.clone();
        let now = now_ms();
        let saved = match id {
            Some(id) => {
                let entry = next
                    .sources
                    .iter_mut()
                    .find(|s| s.id == id)
                    .ok_or_else(|| "That saved configuration no longer exists.".to_string())?;
                entry.name = name.trim().into();
                entry.config = config;
                entry.updated_ms = now;
                entry.clone()
            }
            None => {
                if next.sources.len() >= MAX_SAVED_SOURCES {
                    return Err(format!(
                        "At most {MAX_SAVED_SOURCES} configurations can be saved."
                    ));
                }
                let saved = SavedSource {
                    id: unique_id(&next.sources, now),
                    name: name.trim().into(),
                    config,
                    created_ms: now,
                    updated_ms: now,
                };
                next.sources.push(saved.clone());
                saved
            }
        };
        write_json_atomic(&self.dir.join(SOURCES_FILE), &next)
            .map_err(|e| format!("Could not save source configurations: {e}"))?;
        *guard = next;
        Ok(saved)
    }

    pub fn delete_source(&self, id: &str) -> Result<(), String> {
        let mut guard = lock(&self.sources);
        let mut next = guard.clone();
        let before = next.sources.len();
        next.sources.retain(|s| s.id != id);
        if next.sources.len() == before {
            return Err("That saved configuration no longer exists.".into());
        }
        write_json_atomic(&self.dir.join(SOURCES_FILE), &next)
            .map_err(|e| format!("Could not save source configurations: {e}"))?;
        *guard = next;
        Ok(())
    }
}

fn unique_id(existing: &[SavedSource], now: f64) -> String {
    let mut n = now as u64;
    loop {
        let id = format!("src-{n:x}");
        if !existing.iter().any(|s| s.id == id) {
            return id;
        }
        n += 1;
    }
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{ParamValue, WindowKind};

    #[test]
    fn missing_files_give_defaults_without_warnings() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        assert_eq!(store.preferences(), Preferences::default());
        assert!(store.saved_sources().is_empty());
        assert!(store.warnings().is_empty());
    }

    #[test]
    fn preferences_persist_across_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        store
            .update_preferences(|p| {
                p.processing.fft_size = 8192;
                p.processing.window = WindowKind::FlatTop;
                p.display.palette = Palette::Viridis;
                p.last_source = Some(SourceConfig::new("simulator"));
            })
            .unwrap();
        let reopened = ConfigStore::open(dir.path());
        let p = reopened.preferences();
        assert_eq!(p.processing.fft_size, 8192);
        assert_eq!(p.processing.window, WindowKind::FlatTop);
        assert_eq!(p.display.palette, Palette::Viridis);
        assert_eq!(p.last_source.unwrap().driver_id, "simulator");
    }

    #[test]
    fn invalid_updates_are_rejected_and_not_saved() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        let err = store
            .update_preferences(|p| p.display.range_db = 5.0)
            .unwrap_err();
        assert!(err.contains("range"));
        assert_eq!(store.preferences(), Preferences::default());
        assert!(!dir.path().join(PREFERENCES_FILE).exists());
    }

    #[test]
    fn corrupt_files_are_backed_up_and_reset() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(PREFERENCES_FILE), b"{ not json").unwrap();
        fs::write(
            dir.path().join(SOURCES_FILE),
            br#"{"version":1,"sources":[{"id":"a","name":"  ","config":{"driverId":"simulator"},"createdMs":0,"updatedMs":0}]}"#,
        )
        .unwrap();
        let store = ConfigStore::open(dir.path());
        assert_eq!(store.warnings().len(), 2);
        assert!(store.warnings()[0].contains("reset to defaults"));
        assert_eq!(store.preferences(), Preferences::default());
        let backups = fs::read_dir(dir.path())
            .unwrap()
            .filter(|e| {
                e.as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .contains("corrupt")
            })
            .count();
        assert_eq!(backups, 2);
    }

    #[test]
    fn older_files_with_missing_fields_load_with_defaults() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join(PREFERENCES_FILE),
            br#"{"version":1,"display":{"rangeDb":80}}"#,
        )
        .unwrap();
        let store = ConfigStore::open(dir.path());
        assert!(store.warnings().is_empty());
        assert_eq!(store.preferences().display.range_db, 80.0);
        assert!(store.preferences().display.show_waterfall);
    }

    #[test]
    fn saved_sources_create_update_delete() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        let mut config = SourceConfig::new("simulator");
        config.settings.center_hz = Some(433.92e6);
        config
            .settings
            .params
            .insert("tone1Dbfs".into(), ParamValue::Number(-30.0));
        let a = store
            .save_source(None, " ISM band ", config.clone())
            .unwrap();
        let b = store.save_source(None, "FM", config.clone()).unwrap();
        assert_ne!(a.id, b.id);
        assert_eq!(a.name, "ISM band");

        let renamed = store.save_source(Some(&a.id), "ISM 433", config).unwrap();
        assert_eq!(renamed.id, a.id);
        assert!(store.save_source(None, "", SourceConfig::new("x")).is_err());
        assert!(
            store
                .save_source(Some("missing"), "x", SourceConfig::new("x"))
                .is_err()
        );

        store.delete_source(&b.id).unwrap();
        assert!(store.delete_source(&b.id).is_err());

        let reopened = ConfigStore::open(dir.path());
        let saved = reopened.saved_sources();
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].name, "ISM 433");
        assert_eq!(saved[0].config.settings.center_hz, Some(433.92e6));
    }
}
