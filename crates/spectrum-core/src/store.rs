//! Local persistence of preferences and remembered sources as versioned JSON files.
//!
//! Sources are remembered automatically when a connection succeeds (see ADR 0009). Entries of
//! drivers that are unknown or not available are kept on disk untouched and only hidden from
//! [`connectable`].
//!
//! Writes are atomic (temporary file + rename). Unreadable or invalid files are moved aside and
//! replaced by defaults, and a warning is reported instead of failing start-up.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::model::params::resolve_params;
use crate::model::session::now_ms;
use crate::model::{
    ActiveSource, DriverInfo, DriverStatus, ParamValue, ProcessingSettings, SettingsPatch,
    SourceConfig, SourceKind, SourceSettings, SourceUpdate,
};

pub const PREFERENCES_FILE: &str = "preferences.json";
pub const SOURCES_FILE: &str = "sources.json";
/// Schema version of `preferences.json` (version 2 fields are additive and defaulted).
pub const SCHEMA_VERSION: u32 = 1;
/// Schema version of `sources.json`: 2 adds `label` and `lastUsedMs`; 3 keys entries on a stable
/// device identity (see ADR 0010) and is written together with a `sources.pre-v3-*.json` backup.
pub const SOURCES_SCHEMA_VERSION: u32 = 3;
/// Longest name accepted when loading or restoring (longer ones are truncated on load).
const MAX_NAME_LENGTH: usize = 80;
/// Longest name a user can set (`add_source`, `update_source`).
pub const MAX_NAME_INPUT: usize = 60;
const MAX_DEVICE_ID_LENGTH: usize = 200;
const MAX_LABEL_LENGTH: usize = 200;
const MAX_SAVED_SOURCES: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum Palette {
    #[default]
    Classic,
    Viridis,
    Grayscale,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase", default)]
#[cfg_attr(feature = "bindings", ts(export))]
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase", default)]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct Preferences {
    pub version: u32,
    pub processing: ProcessingSettings,
    pub display: DisplayPreferences,
    /// Deprecated: migrated into a remembered source and `last_source_id` when loaded.
    pub last_source: Option<SourceConfig>,
    /// Remembered source selected when the application was last used (never connected
    /// automatically).
    pub last_source_id: Option<String>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: SCHEMA_VERSION,
            processing: ProcessingSettings::default(),
            display: DisplayPreferences::default(),
            last_source: None,
            last_source_id: None,
        }
    }
}

impl Preferences {
    pub fn validate(&self) -> Result<(), String> {
        self.processing.validate()?;
        self.display.validate()
    }
}

/// A source the user connected to before, with the settings it was last used with.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SavedSource {
    pub id: String,
    /// User override of the displayed name; empty means none (the UI shows `label`).
    #[serde(default)]
    pub name: String,
    /// Automatic name captured from the device at connect time; empty for migrated entries.
    #[serde(default)]
    pub label: String,
    /// Connection plus the last effective settings.
    pub config: SourceConfig,
    pub created_ms: f64,
    pub updated_ms: f64,
    /// Ordering key: most recently used first.
    #[serde(default)]
    pub last_used_ms: f64,
}

/// Remembered sources that can be connected now, plus the one selected last time.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub struct SourceList {
    pub sources: Vec<SavedSource>,
    pub active_id: Option<String>,
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
            version: SOURCES_SCHEMA_VERSION,
            sources: Vec::new(),
        }
    }
}

impl SavedSources {
    /// Brings a freshly loaded file up to date in memory (the file itself is rewritten only by
    /// the next change). Never discards an entry.
    fn normalize(&mut self) {
        // Version 1 had no `lastUsedMs`.
        let legacy = self.version < 2;
        for s in &mut self.sources {
            if legacy {
                s.last_used_ms = s.updated_ms;
            }
            if s.name.chars().count() > MAX_NAME_LENGTH {
                s.name = s.name.chars().take(MAX_NAME_LENGTH).collect();
            }
        }
    }
}

/// Whether two configs refer to the same device (settings excluded). With a device id on both
/// sides the id decides and the connection is only a hint for finding the device; with none on
/// either side the connection decides; one with and one without is not the same (ADR 0010).
pub fn same_identity(a: &SourceConfig, b: &SourceConfig) -> bool {
    if a.driver_id != b.driver_id {
        return false;
    }
    match (&a.device_id, &b.device_id) {
        (Some(x), Some(y)) => x == y,
        (None, None) => a.connection == b.connection,
        _ => false,
    }
}

/// The name shown for a record: the user's name, else the automatic label.
fn effective_name(s: &SavedSource) -> &str {
    if s.name.trim().is_empty() {
        s.label.trim()
    } else {
        s.name.trim()
    }
}

/// Checks a user-entered name and returns it trimmed. It must be 1..=60 characters and, compared
/// case-insensitively, differ from the displayed name of every other record (`except_id` is the
/// record being edited).
pub fn validate_name(
    list: &[SavedSource],
    name: &str,
    except_id: Option<&str>,
) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Enter a name.".into());
    }
    if name.chars().count() > MAX_NAME_INPUT {
        return Err(format!("Names are limited to {MAX_NAME_INPUT} characters."));
    }
    let wanted = name.to_lowercase();
    if list
        .iter()
        .filter(|s| Some(s.id.as_str()) != except_id)
        .any(|s| effective_name(s).to_lowercase() == wanted)
    {
        return Err(format!(
            "The name \"{name}\" is already used by another source."
        ));
    }
    Ok(name.to_string())
}

fn duplicate_identity_error(other: &SavedSource) -> String {
    format!(
        "This device is already in Your sources as \"{}\".",
        effective_name(other)
    )
}

/// Merges records that refer to one device into one: the survivor keeps its id; the user's name
/// is never dropped (a named record wins over unnamed ones, then the most recently used wins).
/// It gets the newest use, the oldest creation, the newest settings and label, and the newest
/// non-empty connection hint.
///
/// Panics if `group` is empty.
pub fn merge_records(group: &[SavedSource]) -> SavedSource {
    let by_use = |a: &&SavedSource, b: &&SavedSource| a.last_used_ms.total_cmp(&b.last_used_ms);
    let newest = group.iter().max_by(by_use).expect("a non-empty group");
    let mut merged = group
        .iter()
        .filter(|s| !s.name.trim().is_empty())
        .max_by(by_use)
        .unwrap_or(newest)
        .clone();
    let mut newest_first: Vec<&SavedSource> = group.iter().collect();
    newest_first.sort_by(|a, b| b.last_used_ms.total_cmp(&a.last_used_ms));

    merged.last_used_ms = newest.last_used_ms;
    merged.created_ms = group
        .iter()
        .map(|s| s.created_ms)
        .fold(f64::INFINITY, f64::min);
    merged.updated_ms = group.iter().map(|s| s.updated_ms).fold(0.0, f64::max);
    merged.config.settings = newest.config.settings.clone();
    merged.label = newest_first
        .iter()
        .map(|s| s.label.as_str())
        .find(|l| !l.is_empty())
        .unwrap_or_default()
        .to_string();
    if let Some(s) = newest_first
        .iter()
        .find(|s| !s.config.connection.is_empty())
    {
        merged.config.connection = s.config.connection.clone();
    }
    merged
}

/// Names of the group that a merge into `kept` discards.
fn lost_names(group: &[SavedSource], kept: &SavedSource) -> Vec<String> {
    let mut lost: Vec<String> = Vec::new();
    for s in group {
        let n = s.name.trim();
        if !n.is_empty() && n != kept.name.trim() && !lost.iter().any(|l| l == n) {
            lost.push(n.to_string());
        }
    }
    lost
}

/// What [`dedupe`] did.
#[derive(Default)]
struct Deduped {
    /// Merged-away id -> surviving id.
    repoint: HashMap<String, String>,
    /// (label, discarded name) pairs.
    lost: Vec<(String, String)>,
}

/// Merges records of one device (same driver and device id) and, for records without a device id,
/// records that are indistinguishable (same driver, connection and displayed name). Records with
/// different names or settings and no device id are different presets and are never merged.
fn dedupe(sources: &mut Vec<SavedSource>) -> Deduped {
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut seen: HashMap<(String, String, String), usize> = HashMap::new();
    for (i, s) in sources.iter().enumerate() {
        let key = match &s.config.device_id {
            Some(id) => (s.config.driver_id.clone(), "id".to_string(), id.clone()),
            None => (
                s.config.driver_id.clone(),
                serde_json::to_string(&s.config.connection).unwrap_or_default(),
                effective_name(s).to_string(),
            ),
        };
        match seen.get(&key) {
            Some(&g) => groups[g].push(i),
            None => {
                seen.insert(key, groups.len());
                groups.push(vec![i]);
            }
        }
    }
    let mut out = Deduped::default();
    let mut remove = vec![false; sources.len()];
    for group in groups.iter().filter(|g| g.len() > 1) {
        let members: Vec<SavedSource> = group.iter().map(|&i| sources[i].clone()).collect();
        let merged = merge_records(&members);
        for (name_owner, &i) in members.iter().zip(group) {
            if name_owner.id == merged.id {
                sources[i] = merged.clone();
            } else {
                remove[i] = true;
                out.repoint.insert(name_owner.id.clone(), merged.id.clone());
            }
        }
        for lost in lost_names(&members, &merged) {
            out.lost.push((effective_label(&merged), lost));
        }
    }
    let mut i = 0;
    sources.retain(|_| {
        i += 1;
        !remove[i - 1]
    });
    out
}

fn effective_label(s: &SavedSource) -> String {
    if s.label.trim().is_empty() {
        s.name.clone()
    } else {
        s.label.clone()
    }
}

/// A legacy device id that is a serial port path rather than a device identity.
fn looks_like_port(id: &str) -> bool {
    id.starts_with("/dev/") || id.starts_with("COM")
}

/// Hook that asks a driver for the stable id of a stored entry: (driver id, stored device id,
/// automatic label) -> new id.
pub type NormalizeDeviceId<'a> = dyn Fn(&str, Option<&str>, &str) -> Option<String> + 'a;

/// Applies the driver hook to every entry. Returns whether anything changed.
fn normalize_identities(sources: &mut [SavedSource], normalize: &NormalizeDeviceId) -> bool {
    let mut changed = false;
    for s in sources {
        let old = s.config.device_id.clone();
        let Some(new) = normalize(&s.config.driver_id, old.as_deref(), &s.label) else {
            continue;
        };
        if old.as_deref() == Some(new.as_str()) {
            continue;
        }
        if let Some(old) = old.filter(|o| looks_like_port(o)) {
            s.config
                .connection
                .entry("port".into())
                .or_insert(ParamValue::Text(old));
        }
        s.config.device_id = Some(new);
        changed = true;
    }
    changed
}

/// The remembered sources that can be connected now: registered, `Available` drivers only,
/// most recently used first.
pub fn connectable(all: &[SavedSource], drivers: &[DriverInfo]) -> Vec<SavedSource> {
    let mut list: Vec<SavedSource> = all
        .iter()
        .filter(|s| {
            drivers
                .iter()
                .any(|d| d.id == s.config.driver_id && d.status == DriverStatus::Available)
        })
        .cloned()
        .collect();
    list.sort_by(|a, b| b.last_used_ms.total_cmp(&a.last_used_ms));
    list
}

fn effective_patch(settings: &SourceSettings) -> SettingsPatch {
    SettingsPatch {
        center_hz: Some(settings.center_hz),
        span_hz: Some(settings.span_hz),
        params: settings.params.clone(),
    }
}

fn validate_restored(s: &SavedSource) -> Result<(), String> {
    if s.id.trim().is_empty() {
        return Err("The source has no id.".into());
    }
    if s.config.driver_id.trim().is_empty() {
        return Err("The source has no driver.".into());
    }
    if s.name.chars().count() > MAX_NAME_LENGTH {
        return Err(format!(
            "Names are limited to {MAX_NAME_LENGTH} characters."
        ));
    }
    if s.label.chars().count() > MAX_LABEL_LENGTH {
        return Err("The source label is too long.".into());
    }
    if ![s.created_ms, s.updated_ms, s.last_used_ms]
        .iter()
        .all(|t| t.is_finite())
    {
        return Err("The source has an invalid timestamp.".into());
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

/// Copies `from` to `to`, refusing to overwrite an existing backup.
fn copy_new(from: &Path, to: &Path) -> io::Result<()> {
    let mut src = fs::File::open(from)?;
    let mut dst = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(to)?;
    io::copy(&mut src, &mut dst)?;
    dst.sync_all()
}

/// `sources.pre-v3-<epoch ms>.json` in `dir`, one that does not exist yet.
fn backup_path(dir: &Path) -> PathBuf {
    let mut n = now_ms() as u64;
    loop {
        let path = dir.join(format!("sources.pre-v3-{n}.json"));
        if !path.exists() {
            return path;
        }
        n += 1;
    }
}

/// Thread-safe access to the persisted files in one configuration directory.
pub struct ConfigStore {
    dir: PathBuf,
    preferences: Mutex<Preferences>,
    sources: Mutex<SavedSources>,
    /// The in-memory sources are not on disk yet (a migration or a failed upgrade write).
    sources_unsaved: AtomicBool,
    /// The pre-upgrade backup that still has to be made before `sources.json` is replaced.
    backup_pending: Mutex<Option<PathBuf>>,
    warnings: Vec<String>,
}

impl ConfigStore {
    /// Opens the store without asking drivers to normalize device ids (tests, tools).
    pub fn open(dir: impl Into<PathBuf>) -> Self {
        Self::open_with(dir, &|_, _, _| None)
    }

    /// Opens the store. A `sources.json` older than version 3 is migrated: device ids are
    /// normalized through `normalize` (driver id, stored id, label -> stable id), duplicate
    /// records of one device are merged, the old file is copied to `sources.pre-v3-<ms>.json` and
    /// the result is written as version 3. A newer file is left alone. If the backup or the write
    /// fails the result is kept in memory and the next successful change retries.
    pub fn open_with(dir: impl Into<PathBuf>, normalize: &NormalizeDeviceId) -> Self {
        let dir = dir.into();
        let (preferences, w1) =
            load_or_default::<Preferences>(&dir.join(PREFERENCES_FILE), Preferences::validate);
        let (mut sources, w2) =
            load_or_default::<SavedSources>(&dir.join(SOURCES_FILE), |_| Ok(()));
        let mut preferences = preferences;
        let mut warnings: Vec<String> = w1.into_iter().chain(w2).collect();
        let upgrade = sources.version < SOURCES_SCHEMA_VERSION;
        sources.normalize();

        let backup = upgrade.then(|| backup_path(&dir));
        let mut repointed = false;
        if let Some(backup) = &backup {
            normalize_identities(&mut sources.sources, normalize);
            let merged = dedupe(&mut sources.sources);
            if let Some(id) = &preferences.last_source_id
                && let Some(survivor) = merged.repoint.get(id)
            {
                preferences.last_source_id = Some(survivor.clone());
                repointed = true;
            }
            let file = backup.file_name().unwrap_or_default().to_string_lossy();
            for (label, lost) in &merged.lost {
                warnings.push(format!(
                    "Merged duplicate entries for {label}; the name \"{lost}\" is kept only in the backup {file}."
                ));
            }
            sources.version = SOURCES_SCHEMA_VERSION;
        }
        // In-memory migration of the deprecated `lastSource`; persisted by the next write.
        let migrated = migrate_last_source(&mut preferences, &mut sources);

        let mut unsaved = migrated;
        let mut backup_pending = None;
        if let Some(backup) = backup {
            let file = dir.join(SOURCES_FILE);
            match copy_new(&file, &backup) {
                Err(e) => {
                    warnings.push(format!(
                        "Could not back up {} before upgrading it: {e}. The upgraded list is used for now and saved with the next change.",
                        file.display()
                    ));
                    backup_pending = Some(backup);
                    unsaved = true;
                }
                Ok(()) => match write_json_atomic(&file, &sources) {
                    Err(e) => {
                        warnings.push(format!(
                            "Could not save the upgraded {}: {e}. It is saved with the next change.",
                            file.display()
                        ));
                        unsaved = true;
                    }
                    Ok(()) => {
                        unsaved = false;
                        if (repointed || migrated)
                            && let Err(e) =
                                write_json_atomic(&dir.join(PREFERENCES_FILE), &preferences)
                        {
                            warnings.push(format!("Could not save preferences: {e}"));
                        }
                    }
                },
            }
        }
        Self {
            dir,
            preferences: Mutex::new(preferences),
            sources: Mutex::new(sources),
            sources_unsaved: AtomicBool::new(unsaved),
            backup_pending: Mutex::new(backup_pending),
            warnings,
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
        if self.sources_unsaved.load(Ordering::Relaxed) {
            // Persist a migrated entry before preferences start pointing at it.
            let mut sources = lock(&self.sources);
            let snapshot = sources.clone();
            self.commit_sources(&mut sources, snapshot)?;
        }
        write_json_atomic(&self.dir.join(PREFERENCES_FILE), &next)
            .map_err(|e| format!("Could not save preferences: {e}"))?;
        *guard = next.clone();
        Ok(next)
    }

    /// Every remembered source, including those of drivers that are not available.
    pub fn sources_all(&self) -> Vec<SavedSource> {
        lock(&self.sources).sources.clone()
    }

    /// The sources the UI may offer, plus the last selected one (if still offered).
    pub fn source_list(&self, drivers: &[DriverInfo]) -> SourceList {
        let sources = connectable(&lock(&self.sources).sources, drivers);
        let active_id = self
            .preferences()
            .last_source_id
            .filter(|id| sources.iter().any(|s| &s.id == id));
        SourceList { sources, active_id }
    }

    /// Writes `next` to disk and, on success, makes it current.
    fn commit_sources(
        &self,
        guard: &mut SavedSources,
        mut next: SavedSources,
    ) -> Result<(), String> {
        next.version = SOURCES_SCHEMA_VERSION;
        let mut pending = lock(&self.backup_pending);
        if let Some(backup) = pending.as_ref() {
            copy_new(&self.dir.join(SOURCES_FILE), backup).map_err(|e| {
                format!("Could not back up the old sources file before upgrading it: {e}")
            })?;
            *pending = None;
        }
        drop(pending);
        write_json_atomic(&self.dir.join(SOURCES_FILE), &next)
            .map_err(|e| format!("Could not save sources: {e}"))?;
        *guard = next;
        self.sources_unsaved.store(false, Ordering::Relaxed);
        Ok(())
    }

    /// Remembers a source that just connected: updates the entry `id` (or, without one, the most
    /// recently used entry with the same identity) or creates one. Stores the automatic label and
    /// the effective settings and marks it used now. At the cap the least recently used entry of
    /// an available driver is evicted; if there is none the call fails (the caller logs it).
    pub fn remember_connected(
        &self,
        id: Option<&str>,
        active: &ActiveSource,
        driver_available: impl Fn(&str) -> bool,
    ) -> Result<SavedSource, String> {
        let mut config = active.config.clone();
        config.settings = effective_patch(&active.settings);
        let label: String = active
            .device_label
            .trim()
            .chars()
            .take(MAX_LABEL_LENGTH)
            .collect();
        let now = now_ms();

        let mut guard = lock(&self.sources);
        let mut next = guard.clone();
        let target = match id.and_then(|id| next.sources.iter().position(|s| s.id == id)) {
            Some(i) => Some(i),
            None => next
                .sources
                .iter()
                .enumerate()
                .filter(|(_, s)| same_identity(&s.config, &config))
                .max_by(|(_, a), (_, b)| a.last_used_ms.total_cmp(&b.last_used_ms))
                .map(|(i, _)| i),
        };
        let saved = match target {
            Some(i) => {
                let entry = &mut next.sources[i];
                entry.config = config;
                entry.label = label;
                entry.updated_ms = now;
                entry.last_used_ms = now;
                let updated = entry.clone();
                // The connect resolved to a device another record already owns (typically a
                // record with an untested port): they are one device, merge them.
                let owners: Vec<usize> = match &updated.config.device_id {
                    Some(_) => next
                        .sources
                        .iter()
                        .enumerate()
                        .filter(|(j, s)| *j != i && same_identity(&s.config, &updated.config))
                        .map(|(j, _)| j)
                        .collect(),
                    None => Vec::new(),
                };
                if owners.is_empty() {
                    updated
                } else {
                    let mut group = vec![updated];
                    group.extend(owners.iter().map(|&j| next.sources[j].clone()));
                    let merged = merge_records(&group);
                    for lost in lost_names(&group, &merged) {
                        tracing::warn!(name = %lost, "merged duplicate sources; this name was dropped");
                    }
                    next.sources[i] = merged.clone();
                    for &j in owners.iter().rev() {
                        next.sources.remove(j);
                    }
                    merged
                }
            }
            None => {
                make_room(&mut next, &driver_available)?;
                let saved = SavedSource {
                    id: unique_id(&next.sources, now),
                    name: String::new(),
                    label,
                    config,
                    created_ms: now,
                    updated_ms: now,
                    last_used_ms: now,
                };
                next.sources.push(saved.clone());
                saved
            }
        };
        self.commit_sources(&mut guard, next)?;
        Ok(saved)
    }

    /// Stores the effective settings of a remembered source. Does nothing if `id` is unknown.
    pub fn update_source_settings(
        &self,
        id: &str,
        settings: &SourceSettings,
    ) -> Result<(), String> {
        let mut guard = lock(&self.sources);
        let mut next = guard.clone();
        let Some(entry) = next.sources.iter_mut().find(|s| s.id == id) else {
            return Ok(());
        };
        entry.config.settings = effective_patch(settings);
        entry.updated_ms = now_ms();
        self.commit_sources(&mut guard, next)
    }

    /// Creates a record for a device or manual connection without connecting. `driver` is the
    /// registered driver of `config`; `driver_available` tells which drivers can be evicted when
    /// the cap is reached. Validation order: name, driver, connection, identity, cap.
    pub fn add_source(
        &self,
        name: &str,
        config: SourceConfig,
        driver: &DriverInfo,
        driver_available: impl Fn(&str) -> bool,
    ) -> Result<SavedSource, String> {
        let mut guard = lock(&self.sources);
        let name = validate_name(&guard.sources, name, None)?;
        if driver.id != config.driver_id || driver.status != DriverStatus::Available {
            return Err("That source type is not available.".into());
        }
        match driver.kind {
            SourceKind::File => return Err("Use Open file\u{2026} to open a file.".into()),
            SourceKind::Simulator => {
                return Err("The built-in simulator is always available.".into());
            }
            SourceKind::Sdr | SourceKind::SpectrumAnalyzer => {}
        }
        let device_id = clean_device_id(config.device_id.as_deref())?;
        let resolved = resolve_params(&driver.connection_params, &config.connection)?;
        require_handle(driver, &device_id, &resolved)?;
        let config = SourceConfig {
            driver_id: config.driver_id,
            device_id,
            connection: config.connection,
            settings: SettingsPatch::default(),
        };
        if let Some(other) = guard
            .sources
            .iter()
            .find(|s| same_identity(&s.config, &config))
        {
            return Err(duplicate_identity_error(other));
        }
        let mut next = guard.clone();
        make_room(&mut next, &driver_available)?;
        let now = now_ms();
        let saved = SavedSource {
            id: unique_id(&next.sources, now),
            name,
            label: String::new(),
            config,
            created_ms: now,
            updated_ms: now,
            last_used_ms: now,
        };
        next.sources.push(saved.clone());
        self.commit_sources(&mut guard, next)?;
        Ok(saved)
    }

    /// Edits a record's name and how it is reached. `locked` is true while the record is the
    /// source of the live session: then only the name may change. Settings, `created_ms` and
    /// `last_used_ms` are kept.
    pub fn update_source(
        &self,
        id: &str,
        update: &SourceUpdate,
        driver: &DriverInfo,
        locked: bool,
    ) -> Result<SavedSource, String> {
        let mut guard = lock(&self.sources);
        let current = guard
            .sources
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| "That source no longer exists.".to_string())?
            .clone();
        let name = validate_name(&guard.sources, &update.name, Some(id))?;
        if driver.id != current.config.driver_id || driver.status != DriverStatus::Available {
            return Err("That source type is not available.".into());
        }
        let device_id = match &update.device_id {
            Some(_) => clean_device_id(update.device_id.as_deref())?,
            None => current.config.device_id.clone(),
        };
        let connection_changed = update.connection != current.config.connection;
        let identity_changed = device_id != current.config.device_id;
        match driver.kind {
            SourceKind::File if connection_changed || identity_changed => {
                return Err("The file cannot be changed.".into());
            }
            SourceKind::Simulator if connection_changed || identity_changed => {
                return Err("The simulator has no settings.".into());
            }
            SourceKind::File | SourceKind::Simulator => {}
            SourceKind::Sdr | SourceKind::SpectrumAnalyzer => {
                let resolved = resolve_params(&driver.connection_params, &update.connection)?;
                require_handle(driver, &device_id, &resolved)?;
            }
        }
        if locked && (connection_changed || identity_changed) {
            return Err("Disconnect first to change the connection settings.".into());
        }
        let mut config = current.config.clone();
        config.device_id = device_id;
        config.connection = update.connection.clone();
        if let Some(other) = guard
            .sources
            .iter()
            .find(|s| s.id != id && same_identity(&s.config, &config))
        {
            return Err(duplicate_identity_error(other));
        }
        let mut next = guard.clone();
        let entry = next
            .sources
            .iter_mut()
            .find(|s| s.id == id)
            .ok_or_else(|| "That source no longer exists.".to_string())?;
        entry.name = name;
        entry.config = config;
        entry.updated_ms = now_ms();
        let saved = entry.clone();
        self.commit_sources(&mut guard, next)?;
        Ok(saved)
    }

    /// Removes a remembered source and returns it (so it can be restored).
    pub fn forget_source(&self, id: &str) -> Result<SavedSource, String> {
        let mut guard = lock(&self.sources);
        let mut next = guard.clone();
        let i = next
            .sources
            .iter()
            .position(|s| s.id == id)
            .ok_or_else(|| "That source no longer exists.".to_string())?;
        let removed = next.sources.remove(i);
        self.commit_sources(&mut guard, next)?;
        Ok(removed)
    }

    /// Re-inserts a forgotten source with its id and timestamps (Undo).
    pub fn restore_source(&self, source: SavedSource) -> Result<(), String> {
        validate_restored(&source)?;
        let mut guard = lock(&self.sources);
        if guard.sources.iter().any(|s| s.id == source.id) {
            return Err("That source already exists.".into());
        }
        // Presets without a device id (simulator, files) legitimately share an identity.
        if source.config.device_id.is_some()
            && guard
                .sources
                .iter()
                .any(|s| same_identity(&s.config, &source.config))
        {
            return Err("That source already exists.".into());
        }
        if guard.sources.len() >= MAX_SAVED_SOURCES {
            return Err(format!(
                "At most {MAX_SAVED_SOURCES} sources can be remembered."
            ));
        }
        let mut next = guard.clone();
        next.sources.push(source);
        self.commit_sources(&mut guard, next)
    }

    /// Records which remembered source is selected (restored, not connected, at next start).
    pub fn set_last_source_id(&self, id: Option<&str>) -> Result<(), String> {
        self.update_preferences(|p| p.last_source_id = id.map(str::to_owned))
            .map(|_| ())
    }
}

/// Moves the deprecated `last_source` into a remembered entry plus `last_source_id`. Returns
/// whether `sources` changed.
fn migrate_last_source(prefs: &mut Preferences, sources: &mut SavedSources) -> bool {
    let Some(config) = prefs.last_source.take() else {
        return false;
    };
    if let Some(existing) = sources
        .sources
        .iter()
        .filter(|s| same_identity(&s.config, &config))
        .max_by(|a, b| a.last_used_ms.total_cmp(&b.last_used_ms))
    {
        prefs.last_source_id = Some(existing.id.clone());
        return false;
    }
    if sources.sources.len() >= MAX_SAVED_SOURCES || config.driver_id.trim().is_empty() {
        return false;
    }
    let now = now_ms();
    let id = unique_id(&sources.sources, now);
    sources.sources.push(SavedSource {
        id: id.clone(),
        name: String::new(),
        label: String::new(),
        config,
        created_ms: now,
        updated_ms: now,
        last_used_ms: now,
    });
    prefs.last_source_id = Some(id);
    true
}

/// Frees a slot at the cap by evicting the least recently used entry of an available driver.
fn make_room(
    next: &mut SavedSources,
    driver_available: &impl Fn(&str) -> bool,
) -> Result<(), String> {
    if next.sources.len() < MAX_SAVED_SOURCES {
        return Ok(());
    }
    let victim = next
        .sources
        .iter()
        .enumerate()
        .filter(|(_, s)| driver_available(&s.config.driver_id))
        .min_by(|(_, a), (_, b)| a.last_used_ms.total_cmp(&b.last_used_ms))
        .map(|(i, _)| i)
        .ok_or_else(|| format!("At most {MAX_SAVED_SOURCES} sources can be remembered."))?;
    next.sources.remove(victim);
    Ok(())
}

/// A device id from the UI: absent, or non-empty and of sane length.
fn clean_device_id(id: Option<&str>) -> Result<Option<String>, String> {
    match id.map(str::trim) {
        None => Ok(None),
        Some("") => Err("The device id must not be empty.".into()),
        Some(id) if id.chars().count() > MAX_DEVICE_ID_LENGTH => {
            Err("The device id is too long.".into())
        }
        Some(id) => Ok(Some(id.to_string())),
    }
}

/// A record of a driver that discovers devices needs a handle: a device id, or every text
/// connection parameter filled in.
fn require_handle(
    driver: &DriverInfo,
    device_id: &Option<String>,
    resolved: &crate::model::ParamMap,
) -> Result<(), String> {
    if !driver.supports_discovery || device_id.is_some() {
        return Ok(());
    }
    for spec in &driver.connection_params {
        if let Some(ParamValue::Text(t)) = resolved.get(&spec.id)
            && t.trim().is_empty()
        {
            return Err(format!("{} is required.", spec.label));
        }
    }
    Ok(())
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
    use crate::model::{
        AmplitudeUnit, Capabilities, DataKind, ParamMap, ParamValue, SourceKind, Transport,
        WindowKind,
    };

    #[test]
    fn missing_files_give_defaults_without_warnings() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        assert_eq!(store.preferences(), Preferences::default());
        assert!(store.sources_all().is_empty());
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
                p.last_source_id = Some("src-1".into());
            })
            .unwrap();
        let reopened = ConfigStore::open(dir.path());
        let p = reopened.preferences();
        assert_eq!(p.processing.fft_size, 8192);
        assert_eq!(p.processing.window, WindowKind::FlatTop);
        assert_eq!(p.display.palette, Palette::Viridis);
        assert_eq!(p.last_source_id.as_deref(), Some("src-1"));
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
            br#"{"version":1,"sources":[{"id":"a","name":"x","config":{"createdMs":0}}]}"#,
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

    fn driver(id: &str, status: DriverStatus) -> DriverInfo {
        DriverInfo {
            id: id.into(),
            name: id.into(),
            description: String::new(),
            kind: SourceKind::Sdr,
            transport: Transport::Usb,
            status,
            supports_discovery: false,
            connection_params: vec![],
        }
    }

    fn active(driver_id: &str, device_id: Option<&str>, label: &str, center: f64) -> ActiveSource {
        let mut config = SourceConfig::new(driver_id);
        config.device_id = device_id.map(Into::into);
        ActiveSource {
            config,
            driver_name: driver_id.into(),
            device_label: label.into(),
            kind: SourceKind::Sdr,
            transport: Transport::Usb,
            simulated: false,
            capabilities: Capabilities {
                data_kind: DataKind::Iq,
                tuning: None,
                span_options_hz: vec![],
                amplitude_unit: AmplitudeUnit::Dbfs,
                finite: false,
                params: vec![],
            },
            settings: SourceSettings {
                center_hz: center,
                span_hz: 2e6,
                params: ParamMap::new(),
            },
        }
    }

    fn all_available(_: &str) -> bool {
        true
    }

    const V1_SOURCES: &str = r#"{"version":1,"sources":[
        {"id":"a","name":"ISM band","config":{"driverId":"simulator","settings":{"centerHz":433920000}},"createdMs":1,"updatedMs":100},
        {"id":"ghost1","name":"Old gear","config":{"driverId":"ghost","deviceId":"g","connection":{"x":1}},"createdMs":2,"updatedMs":300},
        {"id":"plan1","name":"Soapy","config":{"driverId":"soapysdr"},"createdMs":3,"updatedMs":200},
        {"id":"b","name":"FM","config":{"driverId":"simulator"},"createdMs":4,"updatedMs":50}
    ]}"#;

    fn drivers() -> Vec<DriverInfo> {
        vec![
            driver("simulator", DriverStatus::Available),
            driver("soapysdr", DriverStatus::Planned),
        ]
    }

    fn open_v1() -> (tempfile::TempDir, ConfigStore) {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(SOURCES_FILE), V1_SOURCES).unwrap();
        let store = ConfigStore::open(dir.path());
        (dir, store)
    }

    #[test]
    fn v1_sources_are_upgraded_and_hidden_entries_survive_writes() {
        let (dir, store) = open_v1();
        assert!(store.warnings().is_empty());
        assert_eq!(backups(dir.path()).len(), 1, "the old file is backed up");
        assert_eq!(
            fs::read_to_string(&backups(dir.path())[0]).unwrap(),
            V1_SOURCES
        );

        let all = store.sources_all();
        assert_eq!(all.len(), 4);
        assert!(all.iter().all(|s| s.label.is_empty()));
        assert_eq!(all[0].last_used_ms, 100.0);

        let list = store.source_list(&drivers());
        let ids: Vec<_> = list.sources.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["a", "b"], "ghost and planned hidden, newest first");
        assert_eq!(list.active_id, None);

        let ghost = all.iter().find(|s| s.id == "ghost1").cloned().unwrap();
        let planned = all.iter().find(|s| s.id == "plan1").cloned().unwrap();
        store.forget_source("b").unwrap();

        let reopened = ConfigStore::open(dir.path());
        let all = reopened.sources_all();
        assert_eq!(all.len(), 3);
        assert_eq!(all.iter().find(|s| s.id == "ghost1"), Some(&ghost));
        assert_eq!(all.iter().find(|s| s.id == "plan1"), Some(&planned));
        let raw: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.path().join(SOURCES_FILE)).unwrap())
                .unwrap();
        assert_eq!(raw["version"], 3);
    }

    #[test]
    fn long_names_are_truncated_on_load_and_empty_names_are_valid() {
        let dir = tempfile::tempdir().unwrap();
        let long = "x".repeat(120);
        fs::write(
            dir.path().join(SOURCES_FILE),
            format!(
                r#"{{"version":1,"sources":[
                {{"id":"a","name":"{long}","config":{{"driverId":"simulator"}},"createdMs":0,"updatedMs":0}},
                {{"id":"b","name":"","config":{{"driverId":"simulator"}},"createdMs":0,"updatedMs":0}}]}}"#
            ),
        )
        .unwrap();
        let store = ConfigStore::open(dir.path());
        assert!(store.warnings().is_empty());
        let all = store.sources_all();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].name.chars().count(), MAX_NAME_LENGTH);
        assert_eq!(all[1].name, "");
    }

    #[test]
    fn last_source_is_migrated_by_reusing_a_matching_entry() {
        let (dir, _) = open_v1();
        fs::write(
            dir.path().join(PREFERENCES_FILE),
            br#"{"version":1,"lastSource":{"driverId":"simulator","settings":{"centerHz":1}}}"#,
        )
        .unwrap();
        let store = ConfigStore::open(dir.path());
        let prefs = store.preferences();
        assert_eq!(prefs.last_source, None);
        // Two simulator entries match; the most recently used one (a) is reused.
        assert_eq!(prefs.last_source_id.as_deref(), Some("a"));
        assert_eq!(store.sources_all().len(), 4);
        assert_eq!(
            store.source_list(&drivers()).active_id.as_deref(),
            Some("a")
        );
    }

    #[test]
    fn last_source_is_migrated_into_a_new_entry_persisted_with_preferences() {
        let dir = tempfile::tempdir().unwrap();
        let prefs = dir.path().join(PREFERENCES_FILE);
        fs::write(
            &prefs,
            br#"{"version":1,"lastSource":{"driverId":"simulator","deviceId":"d"}}"#,
        )
        .unwrap();
        let store = ConfigStore::open(dir.path());
        let all = store.sources_all();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].config.device_id.as_deref(), Some("d"));
        let id = store.preferences().last_source_id.unwrap();
        assert_eq!(id, all[0].id);
        assert!(
            !dir.path().join(SOURCES_FILE).exists(),
            "load does not write"
        );

        store
            .update_preferences(|p| p.display.range_db = 90.0)
            .unwrap();
        let reopened = ConfigStore::open(dir.path());
        assert_eq!(reopened.preferences().last_source_id, Some(id.clone()));
        assert_eq!(reopened.preferences().last_source, None);
        assert_eq!(reopened.sources_all().len(), 1);
        assert_eq!(reopened.sources_all()[0].id, id);
    }

    #[test]
    fn remembering_creates_then_touches_the_same_identity() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        let first = store
            .remember_connected(
                None,
                &active("sdr", Some("1"), "SDR 1", 100e6),
                all_available,
            )
            .unwrap();
        assert_eq!(first.label, "SDR 1");
        assert_eq!(first.name, "");
        assert_eq!(first.config.settings.center_hz, Some(100e6));
        assert_eq!(first.config.settings.span_hz, Some(2e6));

        std::thread::sleep(std::time::Duration::from_millis(2));
        let again = store
            .remember_connected(
                None,
                &active("sdr", Some("1"), "SDR 1b", 200e6),
                all_available,
            )
            .unwrap();
        assert_eq!(again.id, first.id);
        assert!(again.last_used_ms > first.last_used_ms);
        assert_eq!(again.created_ms, first.created_ms);
        assert_eq!(again.label, "SDR 1b");
        assert_eq!(again.config.settings.center_hz, Some(200e6));

        // Timestamps are whole milliseconds, so keep the next one strictly later.
        std::thread::sleep(std::time::Duration::from_millis(2));
        let other = store
            .remember_connected(None, &active("sdr", Some("2"), "SDR 2", 1e6), all_available)
            .unwrap();
        assert_ne!(other.id, first.id);
        assert_eq!(store.sources_all().len(), 2);
        let list = store.source_list(&[driver("sdr", DriverStatus::Available)]);
        assert_eq!(list.sources[0].id, other.id, "most recent first");

        let reopened = ConfigStore::open(dir.path());
        assert_eq!(reopened.sources_all(), store.sources_all());
    }

    #[test]
    fn legacy_duplicates_stay_separate_and_connect_by_id_targets_one() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(SOURCES_FILE), V1_SOURCES).unwrap();
        let store = ConfigStore::open(dir.path());
        // "a" and "b" share an identity. Connect by id "b" updates only b.
        let b = store
            .remember_connected(
                Some("b"),
                &active("simulator", None, "Sim", 7e6),
                all_available,
            )
            .unwrap();
        assert_eq!(b.id, "b");
        assert_eq!(b.name, "FM");
        let a = store
            .sources_all()
            .into_iter()
            .find(|s| s.id == "a")
            .unwrap();
        assert_eq!(a.config.settings.center_hz, Some(433.92e6));
        assert_eq!(store.sources_all().len(), 4);

        // Without an id the most recently used match (b, just used) is touched.
        let touched = store
            .remember_connected(None, &active("simulator", None, "Sim", 8e6), all_available)
            .unwrap();
        assert_eq!(touched.id, "b");
        // An id that vanished falls back to the identity match.
        let fallback = store
            .remember_connected(
                Some("gone"),
                &active("simulator", None, "Sim", 9e6),
                all_available,
            )
            .unwrap();
        assert_eq!(fallback.id, "b");
    }

    #[test]
    fn cap_evicts_least_recently_used_available_entry_never_a_hidden_one() {
        let dir = tempfile::tempdir().unwrap();
        let mut entries = Vec::new();
        for i in 0..MAX_SAVED_SOURCES {
            // Entry 0 is the oldest and belongs to a hidden driver; entry 1 is the oldest visible.
            let driver = if i == 0 { "ghost" } else { "sdr" };
            entries.push(SavedSource {
                id: format!("s{i}"),
                name: String::new(),
                label: String::new(),
                config: {
                    let mut c = SourceConfig::new(driver);
                    c.device_id = Some(format!("d{i}"));
                    c
                },
                created_ms: 0.0,
                updated_ms: 0.0,
                last_used_ms: 10.0 + i as f64,
            });
        }
        let file = SavedSources {
            version: 3,
            sources: entries,
        };
        write_json_atomic(&dir.path().join(SOURCES_FILE), &file).unwrap();
        let store = ConfigStore::open(dir.path());
        let available = |id: &str| id == "sdr";

        let new = store
            .remember_connected(None, &active("sdr", Some("new"), "New", 1e6), available)
            .unwrap();
        let all = store.sources_all();
        assert_eq!(all.len(), MAX_SAVED_SOURCES);
        assert!(all.iter().any(|s| s.id == "s0"), "hidden entry kept");
        assert!(!all.iter().any(|s| s.id == "s1"), "LRU available evicted");
        assert!(all.iter().any(|s| s.id == new.id));

        // Nothing evictable: the call fails and nothing changes.
        let before = store.sources_all();
        let err = store
            .remember_connected(None, &active("sdr", Some("x"), "X", 1e6), |_| false)
            .unwrap_err();
        assert!(err.contains("At most"));
        assert_eq!(store.sources_all(), before);
    }

    #[test]
    fn update_source_settings_writes_effective_settings_and_ignores_unknown_ids() {
        let (dir, store) = open_v1();
        let settings = SourceSettings {
            center_hz: 99e6,
            span_hz: 4e6,
            params: ParamMap::from([("gain".to_string(), ParamValue::Number(3.0))]),
        };
        store.update_source_settings("a", &settings).unwrap();
        store.update_source_settings("missing", &settings).unwrap();
        let reopened = ConfigStore::open(dir.path());
        let a = reopened
            .sources_all()
            .into_iter()
            .find(|s| s.id == "a")
            .unwrap();
        assert_eq!(a.config.settings, effective_patch(&settings));
        assert_eq!(a.last_used_ms, 100.0, "settings changes do not reorder");
        assert_eq!(reopened.sources_all().len(), 4);
    }

    #[test]
    fn forget_restore() {
        let (dir, store) = open_v1();
        let before = store.sources_all();
        let removed = store.forget_source("a").unwrap();
        assert!(store.forget_source("a").is_err());
        assert_eq!(store.sources_all().len(), 3);

        let mut bad = removed.clone();
        bad.config.driver_id = " ".into();
        assert!(store.restore_source(bad).is_err());
        let mut bad = removed.clone();
        bad.last_used_ms = f64::NAN;
        assert!(store.restore_source(bad).is_err());
        let mut bad = removed.clone();
        bad.name = "z".repeat(81);
        assert!(store.restore_source(bad).is_err());

        store.restore_source(removed.clone()).unwrap();
        assert!(
            store.restore_source(removed.clone()).is_err(),
            "duplicate id"
        );
        let mut after = store.sources_all();
        after.sort_by(|x, y| x.id.cmp(&y.id));
        let mut before = before;
        before.sort_by(|x, y| x.id.cmp(&y.id));
        assert_eq!(
            after.iter().find(|s| s.id == "a"),
            before.iter().find(|s| s.id == "a")
        );
        assert_eq!(ConfigStore::open(dir.path()).sources_all().len(), 4);
    }

    #[test]
    fn restore_rejects_a_record_whose_identity_is_already_remembered() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        let sdr = sdr_driver();
        let first = store
            .add_source("Bench", cfg("sdr", Some("S1"), &[]), &sdr, all_available)
            .unwrap();
        let mut again = first.clone();
        again.id = "other-id".into();
        again.name = "Copy".into();
        assert_eq!(
            store.restore_source(again).unwrap_err(),
            "That source already exists."
        );
        // A forgotten record can come back.
        let gone = store.forget_source(&first.id).unwrap();
        store.restore_source(gone).unwrap();
    }

    #[test]
    fn last_source_id_persists_and_is_hidden_when_not_offered() {
        let (dir, store) = open_v1();
        store.set_last_source_id(Some("a")).unwrap();
        let reopened = ConfigStore::open(dir.path());
        assert_eq!(
            reopened.source_list(&drivers()).active_id.as_deref(),
            Some("a")
        );
        reopened.set_last_source_id(Some("ghost1")).unwrap();
        assert_eq!(reopened.source_list(&drivers()).active_id, None);
        reopened.set_last_source_id(None).unwrap();
        assert_eq!(reopened.preferences().last_source_id, None);
    }

    #[test]
    fn failed_write_leaves_state_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        // A directory where the file should go makes the rename fail.
        fs::create_dir(dir.path().join(SOURCES_FILE)).unwrap();
        assert!(
            store
                .remember_connected(None, &active("sdr", None, "S", 1e6), all_available)
                .is_err()
        );
        assert!(store.sources_all().is_empty());
    }

    // ---- identity ----

    fn cfg(driver: &str, device: Option<&str>, conn: &[(&str, &str)]) -> SourceConfig {
        let mut c = SourceConfig::new(driver);
        c.device_id = device.map(Into::into);
        c.connection = conn
            .iter()
            .map(|(k, v)| (k.to_string(), ParamValue::Text(v.to_string())))
            .collect();
        c
    }

    #[test]
    fn same_identity_table() {
        let none = cfg("d", None, &[]);
        let port = cfg("d", None, &[("port", "/dev/ttyACM0")]);
        let id1 = cfg("d", Some("1"), &[]);
        let id1_port = cfg("d", Some("1"), &[("port", "/dev/ttyACM1")]);
        let id2 = cfg("d", Some("2"), &[]);
        let other_driver = cfg("e", Some("1"), &[]);
        let cases = [
            (&id1, &id1_port, true, "id decides, connection ignored"),
            (&id1, &id2, false, "different ids"),
            (&id1, &other_driver, false, "different drivers"),
            (&none, &none.clone(), true, "no id, same connection"),
            (&none, &port, false, "no id, different connection"),
            (&port, &id1, false, "one with and one without id"),
            (&none, &id1, false, "one with and one without id"),
        ];
        for (a, b, expected, why) in cases {
            assert_eq!(same_identity(a, b), expected, "{why}");
            assert_eq!(same_identity(b, a), expected, "{why} (reversed)");
        }
    }

    // ---- v3 migration ----

    fn sa430_hook(driver: &str, id: Option<&str>, label: &str) -> Option<String> {
        if driver != "sa430" {
            return None;
        }
        if let Some(serial) = label.strip_prefix("SA430 ")
            && !serial.contains(' ')
        {
            return Some(serial.to_string());
        }
        id.map(|i| format!("port:{i}"))
    }

    fn backups(dir: &Path) -> Vec<PathBuf> {
        let mut v: Vec<PathBuf> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("sources.pre-v3-")
            })
            .collect();
        v.sort();
        v
    }

    /// The user's real store (the two duplicated SA430 records), shared with the e2e seed.
    const DUP_STORE: &str = include_str!("../../../e2e/fixtures/seed/migration-dup/sources.json");

    #[test]
    fn migration_merges_the_real_duplicate_sa430_store() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(SOURCES_FILE), DUP_STORE).unwrap();
        // The selection pointed at the entry that is merged away.
        fs::write(
            dir.path().join(PREFERENCES_FILE),
            br#"{"version":1,"lastSourceId":"src-1a192659456"}"#,
        )
        .unwrap();
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        assert!(store.warnings().is_empty(), "{:?}", store.warnings());

        let all = store.sources_all();
        assert_eq!(all.len(), 1);
        let s = &all[0];
        assert_eq!(s.id, "src-1a19264b6bb", "the most recently used survives");
        assert_eq!(s.config.device_id.as_deref(), Some("08FF41E50F8B3A34"));
        assert_eq!(
            s.config.connection.get("port"),
            Some(&ParamValue::Text("/dev/ttyACM0".into()))
        );
        assert_eq!(s.label, "SA430 08FF41E50F8B3A34");
        assert_eq!(s.last_used_ms, 1793459794802.0);
        assert_eq!(s.created_ms, 1793457436347.0);
        assert_eq!(
            store.preferences().last_source_id.as_deref(),
            Some(s.id.as_str())
        );

        // The backup holds the original bytes; the file and preferences are rewritten.
        let b = backups(dir.path());
        assert_eq!(b.len(), 1);
        assert_eq!(fs::read_to_string(&b[0]).unwrap(), DUP_STORE);
        let raw: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.path().join(SOURCES_FILE)).unwrap())
                .unwrap();
        assert_eq!(raw["version"], 3);
        assert_eq!(raw["sources"].as_array().unwrap().len(), 1);
        let prefs: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.path().join(PREFERENCES_FILE)).unwrap())
                .unwrap();
        assert_eq!(prefs["lastSourceId"], "src-1a19264b6bb");

        // Idempotent: a reload gives the same entry and makes no second backup.
        let again = ConfigStore::open_with(dir.path(), &sa430_hook);
        assert_eq!(again.sources_all(), all);
        assert_eq!(backups(dir.path()).len(), 1);
        assert!(again.warnings().is_empty());
    }

    fn entry(id: &str, name: &str, label: &str, config: SourceConfig, used: f64) -> SavedSource {
        SavedSource {
            id: id.into(),
            name: name.into(),
            label: label.into(),
            config,
            created_ms: used,
            updated_ms: used,
            last_used_ms: used,
        }
    }

    fn write_v2(dir: &Path, sources: Vec<SavedSource>) {
        let file = SavedSources {
            version: 2,
            sources,
        };
        write_json_atomic(&dir.join(SOURCES_FILE), &file).unwrap();
    }

    #[test]
    fn migration_keeps_the_name_of_a_named_duplicate_even_if_older() {
        let dir = tempfile::tempdir().unwrap();
        write_v2(
            dir.path(),
            vec![
                entry(
                    "old-named",
                    "Bench",
                    "SA430 A1",
                    cfg("sa430", Some("/dev/ttyACM0"), &[]),
                    10.0,
                ),
                entry("new-unnamed", "", "SA430 A1", cfg("sa430", None, &[]), 20.0),
            ],
        );
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        let all = store.sources_all();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, "old-named");
        assert_eq!(all[0].name, "Bench");
        assert_eq!(all[0].last_used_ms, 20.0);
        assert!(store.warnings().is_empty(), "no name was lost");
    }

    #[test]
    fn migration_with_two_different_names_keeps_the_newer_and_warns() {
        let dir = tempfile::tempdir().unwrap();
        write_v2(
            dir.path(),
            vec![
                entry("a", "Lab", "SA430 A1", cfg("sa430", None, &[]), 10.0),
                entry(
                    "b",
                    "Field",
                    "SA430 A1",
                    cfg("sa430", Some("/dev/ttyACM0"), &[]),
                    20.0,
                ),
            ],
        );
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        let all = store.sources_all();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].name, "Field");
        let backup = backups(dir.path())[0]
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        assert_eq!(
            store.warnings(),
            [format!(
                "Merged duplicate entries for SA430 A1; the name \"Lab\" is kept only in the backup {backup}."
            )]
        );
    }

    #[test]
    fn presets_without_a_device_id_merge_only_when_identical() {
        let dir = tempfile::tempdir().unwrap();
        let mut other = cfg("simulator", None, &[]);
        other.settings.center_hz = Some(5e6);
        write_v2(
            dir.path(),
            vec![
                entry(
                    "p1",
                    "FM",
                    "Built-in simulator",
                    cfg("simulator", None, &[]),
                    10.0,
                ),
                entry("p2", "ISM", "Built-in simulator", other, 20.0),
                entry(
                    "s1",
                    "",
                    "Built-in simulator",
                    cfg("simulator", None, &[]),
                    30.0,
                ),
                entry(
                    "s2",
                    "",
                    "Built-in simulator",
                    cfg("simulator", None, &[]),
                    40.0,
                ),
            ],
        );
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        let ids: Vec<String> = store.sources_all().into_iter().map(|s| s.id).collect();
        assert_eq!(
            ids,
            ["p1", "p2", "s2"],
            "named presets stay, identical ones merge"
        );
        assert!(store.warnings().is_empty());
    }

    #[test]
    fn migration_passes_entries_of_unavailable_drivers_through_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let ghost = entry(
            "g",
            "Old gear",
            "",
            cfg("ghost", Some("g"), &[("x", "1")]),
            5.0,
        );
        let planned = entry("p", "Soapy", "", cfg("soapysdr", None, &[]), 6.0);
        write_v2(dir.path(), vec![ghost.clone(), planned.clone()]);
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        assert_eq!(store.sources_all(), vec![ghost.clone(), planned.clone()]);
        let reopened = ConfigStore::open(dir.path());
        assert_eq!(reopened.sources_all(), vec![ghost, planned]);
    }

    #[test]
    fn current_version_files_load_without_backup_rewrite_or_hook_calls() {
        let dir = tempfile::tempdir().unwrap();
        let file = SavedSources {
            version: 3,
            sources: vec![
                entry("a", "A", "", cfg("sa430", Some("/dev/ttyACM0"), &[]), 1.0),
                entry("b", "B", "", cfg("sa430", Some("/dev/ttyACM0"), &[]), 2.0),
            ],
        };
        write_json_atomic(&dir.path().join(SOURCES_FILE), &file).unwrap();
        let before = fs::read(dir.path().join(SOURCES_FILE)).unwrap();
        let calls = std::cell::Cell::new(0);
        let store = ConfigStore::open_with(dir.path(), &|_, _, _| {
            calls.set(calls.get() + 1);
            None
        });
        assert_eq!(calls.get(), 0);
        assert_eq!(store.sources_all().len(), 2, "no merge outside a migration");
        assert!(backups(dir.path()).is_empty());
        assert_eq!(fs::read(dir.path().join(SOURCES_FILE)).unwrap(), before);
    }

    #[test]
    fn newer_version_files_are_left_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let text = r#"{"version":99,"sources":[],"future":{"x":1}}"#;
        fs::write(dir.path().join(SOURCES_FILE), text).unwrap();
        let calls = std::cell::Cell::new(0);
        let store = ConfigStore::open_with(dir.path(), &|_, _, _| {
            calls.set(calls.get() + 1);
            None
        });
        assert_eq!(calls.get(), 0);
        assert!(store.warnings().is_empty());
        assert!(backups(dir.path()).is_empty());
        assert_eq!(
            fs::read_to_string(dir.path().join(SOURCES_FILE)).unwrap(),
            text
        );
    }

    #[test]
    fn the_hook_is_called_once_per_entry_of_an_old_file() {
        let dir = tempfile::tempdir().unwrap();
        write_v2(
            dir.path(),
            vec![
                entry("a", "", "SA430 A1", cfg("sa430", None, &[]), 1.0),
                entry("b", "X", "", cfg("simulator", None, &[]), 2.0),
            ],
        );
        let seen = std::cell::RefCell::new(Vec::new());
        ConfigStore::open_with(dir.path(), &|d, id, l| {
            seen.borrow_mut()
                .push((d.to_string(), id.map(String::from), l.to_string()));
            None
        });
        assert_eq!(
            *seen.borrow(),
            [
                ("sa430".to_string(), None, "SA430 A1".to_string()),
                ("simulator".to_string(), None, String::new()),
            ]
        );
    }

    #[test]
    fn a_failing_backup_keeps_the_original_and_retries_with_the_next_change() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(SOURCES_FILE), DUP_STORE).unwrap();
        fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o555)).unwrap();
        let writable = fs::write(dir.path().join("probe"), b"").is_ok();
        if writable {
            // Running as root: permissions do not apply, so the failure cannot be provoked.
            fs::remove_file(dir.path().join("probe")).unwrap();
            fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o755)).unwrap();
            return;
        }
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        assert_eq!(
            store.sources_all().len(),
            1,
            "the merge still applies in memory"
        );
        assert_eq!(store.warnings().len(), 1);
        assert!(
            store.warnings()[0].contains("Could not back up"),
            "{:?}",
            store.warnings()
        );
        assert_eq!(
            fs::read_to_string(dir.path().join(SOURCES_FILE)).unwrap(),
            DUP_STORE,
            "the original is never replaced without a backup"
        );
        // Still unwritable: the commit fails and nothing changes.
        assert!(
            store
                .remember_connected(None, &active("sdr", Some("x"), "X", 1e6), all_available)
                .is_err()
        );

        fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o755)).unwrap();
        store
            .remember_connected(None, &active("sdr", Some("x"), "X", 1e6), all_available)
            .unwrap();
        let b = backups(dir.path());
        assert_eq!(b.len(), 1);
        assert_eq!(fs::read_to_string(&b[0]).unwrap(), DUP_STORE);
        let reopened = ConfigStore::open(dir.path());
        assert_eq!(reopened.sources_all().len(), 2);
        assert_eq!(backups(dir.path()).len(), 1);
    }

    #[test]
    fn a_failing_upgrade_write_is_kept_in_memory_and_retried() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(SOURCES_FILE), DUP_STORE).unwrap();
        // A directory where the temporary file goes makes the atomic write fail after the backup.
        fs::create_dir(dir.path().join("sources.json.tmp")).unwrap();
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        assert_eq!(store.sources_all().len(), 1);
        assert!(
            store.warnings()[0].contains("Could not save"),
            "{:?}",
            store.warnings()
        );
        assert_eq!(backups(dir.path()).len(), 1);
        assert_eq!(
            fs::read_to_string(dir.path().join(SOURCES_FILE)).unwrap(),
            DUP_STORE
        );

        fs::remove_dir(dir.path().join("sources.json.tmp")).unwrap();
        store
            .update_preferences(|p| p.display.range_db = 90.0)
            .unwrap();
        let reopened = ConfigStore::open(dir.path());
        assert_eq!(
            reopened.sources_all().len(),
            1,
            "the retry wrote the merged list"
        );
        assert_eq!(backups(dir.path()).len(), 1, "no second backup");
    }

    #[test]
    fn a_legacy_port_id_becomes_the_port_hint_and_an_id_is_never_renormalized() {
        let dir = tempfile::tempdir().unwrap();
        write_v2(
            dir.path(),
            vec![entry(
                "a",
                "",
                "",
                cfg("sa430", Some("/dev/ttyUSB0"), &[]),
                1.0,
            )],
        );
        let store = ConfigStore::open_with(dir.path(), &sa430_hook);
        let c = &store.sources_all()[0].config;
        assert_eq!(c.device_id.as_deref(), Some("port:/dev/ttyUSB0"));
        assert_eq!(
            c.connection.get("port"),
            Some(&ParamValue::Text("/dev/ttyUSB0".into()))
        );
    }

    // ---- merge on connect ----

    #[test]
    fn connect_resolving_to_an_owned_serial_merges_and_keeps_the_users_name() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        let sdr = sdr_driver();
        let named = store
            .add_source("Bench", cfg("sdr", Some("S1"), &[]), &sdr, all_available)
            .unwrap();
        // An unnamed record with an untested port and no identity (as a connect without a
        // device id used to leave behind).
        let mut typed = active("sdr", None, "SDR", 1e6);
        typed.config.connection = cfg("sdr", None, &[("port", "/dev/ttyACM9")]).connection;
        let untested = store
            .remember_connected(None, &typed, all_available)
            .unwrap();
        // It connects and the driver resolves it to serial S1.
        let mut connected = active("sdr", Some("S1"), "SDR S1", 300e6);
        connected.config.connection = cfg("sdr", None, &[("port", "/dev/ttyACM9")]).connection;
        std::thread::sleep(std::time::Duration::from_millis(2));
        let survivor = store
            .remember_connected(Some(&untested.id), &connected, all_available)
            .unwrap();
        assert_eq!(survivor.id, named.id);
        assert_eq!(survivor.name, "Bench");
        assert_eq!(survivor.label, "SDR S1");
        assert_eq!(survivor.config.settings.center_hz, Some(300e6));
        assert_eq!(
            survivor.created_ms,
            named.created_ms.min(untested.created_ms)
        );
        assert_eq!(store.sources_all(), vec![survivor.clone()]);
        assert_eq!(ConfigStore::open(dir.path()).sources_all(), vec![survivor]);
    }

    // ---- add_source ----

    fn sdr_driver() -> DriverInfo {
        DriverInfo {
            supports_discovery: true,
            connection_params: vec![crate::model::ParamSpec {
                id: "port".into(),
                label: "Port".into(),
                group: None,
                help: None,
                kind: crate::model::ParamKind::Text { max_length: 64 },
                default: ParamValue::Text(String::new()),
                required: false,
            }],
            ..driver("sdr", DriverStatus::Available)
        }
    }

    fn sdr_no_discovery() -> DriverInfo {
        DriverInfo {
            supports_discovery: false,
            ..sdr_driver()
        }
    }

    fn kind_driver(id: &str, kind: SourceKind) -> DriverInfo {
        DriverInfo {
            kind,
            ..driver(id, DriverStatus::Available)
        }
    }

    fn new_store() -> (tempfile::TempDir, ConfigStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open(dir.path());
        (dir, store)
    }

    #[test]
    fn add_source_creates_a_record_with_cleared_settings() {
        let (dir, store) = new_store();
        let mut c = cfg("sdr", Some("S1"), &[("port", "/dev/ttyACM0")]);
        c.settings.center_hz = Some(1e6);
        store.set_last_source_id(None).unwrap();
        let saved = store
            .add_source("  Bench  ", c, &sdr_driver(), all_available)
            .unwrap();
        assert_eq!(saved.name, "Bench");
        assert_eq!(saved.label, "");
        assert!(saved.config.settings.is_empty());
        assert_eq!(saved.last_used_ms, saved.created_ms);
        assert_eq!(
            store.preferences().last_source_id,
            None,
            "selection untouched"
        );
        assert_eq!(ConfigStore::open(dir.path()).sources_all(), vec![saved]);
    }

    #[test]
    fn add_source_error_messages() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        let add = |name: &str, c: SourceConfig, d: &DriverInfo| {
            store.add_source(name, c, d, all_available).unwrap_err()
        };
        let ok = || cfg("sdr", Some("S1"), &[]);
        assert_eq!(add("  ", ok(), &sdr), "Enter a name.");
        assert_eq!(
            add(&"n".repeat(61), ok(), &sdr),
            "Names are limited to 60 characters."
        );
        assert_eq!(
            add("x", ok(), &driver("sdr", DriverStatus::Planned)),
            "That source type is not available."
        );
        assert_eq!(
            add("x", ok(), &sdr_other_id()),
            "That source type is not available."
        );
        assert_eq!(
            add(
                "x",
                cfg("f", None, &[]),
                &kind_driver("f", SourceKind::File)
            ),
            "Use Open file\u{2026} to open a file."
        );
        assert_eq!(
            add(
                "x",
                cfg("s", None, &[]),
                &kind_driver("s", SourceKind::Simulator)
            ),
            "The built-in simulator is always available."
        );
        assert_eq!(
            add("x", cfg("sdr", Some("S1"), &[("bogus", "1")]), &sdr),
            "Unknown parameter \"bogus\"."
        );
        assert_eq!(
            add("x", cfg("sdr", None, &[]), &sdr),
            "Port is required.",
            "a discovery driver without an id needs its port"
        );
        assert_eq!(
            add("x", cfg("sdr", Some(" "), &[]), &sdr),
            "The device id must not be empty."
        );
        assert!(store.sources_all().is_empty());
    }

    fn sdr_other_id() -> DriverInfo {
        driver("other", DriverStatus::Available)
    }

    #[test]
    fn add_source_rejects_a_duplicate_identity_naming_the_other_record() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        store
            .add_source("Bench", cfg("sdr", Some("S1"), &[]), &sdr, all_available)
            .unwrap();
        let err = store
            .add_source(
                "Other",
                cfg("sdr", Some("S1"), &[("port", "/dev/ttyACM3")]),
                &sdr,
                all_available,
            )
            .unwrap_err();
        assert_eq!(err, "This device is already in Your sources as \"Bench\".");
        // Without an id the connection decides.
        let manual = sdr_no_discovery();
        store
            .add_source(
                "Typed",
                cfg("sdr", None, &[("port", "/dev/a")]),
                &manual,
                all_available,
            )
            .unwrap();
        let err = store
            .add_source(
                "Typed 2",
                cfg("sdr", None, &[("port", "/dev/a")]),
                &manual,
                all_available,
            )
            .unwrap_err();
        assert_eq!(err, "This device is already in Your sources as \"Typed\".");
        assert!(
            store
                .add_source(
                    "Typed 3",
                    cfg("sdr", None, &[("port", "/dev/b")]),
                    &manual,
                    all_available
                )
                .is_ok()
        );
    }

    #[test]
    fn names_are_unique_case_insensitively_against_name_or_label() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        store
            .remember_connected(
                None,
                &active("sdr", Some("S9"), "SDR S9", 1e6),
                all_available,
            )
            .unwrap();
        store
            .add_source("Bench", cfg("sdr", Some("S1"), &[]), &sdr, all_available)
            .unwrap();
        let err = store
            .add_source(" bench ", cfg("sdr", Some("S2"), &[]), &sdr, all_available)
            .unwrap_err();
        assert_eq!(err, "The name \"bench\" is already used by another source.");
        let err = store
            .add_source("sdr s9", cfg("sdr", Some("S2"), &[]), &sdr, all_available)
            .unwrap_err();
        assert!(err.contains("already used"), "{err}");
    }

    #[test]
    fn validate_name_excludes_the_record_being_edited() {
        let list = vec![
            entry("a", "Bench", "", cfg("sdr", Some("1"), &[]), 1.0),
            entry("b", "", "Lab", cfg("sdr", Some("2"), &[]), 2.0),
        ];
        assert_eq!(validate_name(&list, "bench", Some("a")).unwrap(), "bench");
        assert!(validate_name(&list, "bench", Some("b")).is_err());
        assert!(validate_name(&list, "LAB", None).is_err());
        assert!(validate_name(&list, "LAB", Some("b")).is_ok());
        assert_eq!(
            validate_name(&list, &"y".repeat(60), None).unwrap().len(),
            60
        );
    }

    #[test]
    fn add_source_evicts_at_the_cap_like_connecting() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        for i in 0..MAX_SAVED_SOURCES {
            store
                .add_source(
                    &format!("n{i}"),
                    cfg("sdr", Some(&format!("d{i}")), &[]),
                    &sdr,
                    all_available,
                )
                .unwrap();
            std::thread::sleep(std::time::Duration::from_millis(1));
        }
        let new = store
            .add_source("fresh", cfg("sdr", Some("fresh"), &[]), &sdr, all_available)
            .unwrap();
        let all = store.sources_all();
        assert_eq!(all.len(), MAX_SAVED_SOURCES);
        assert!(
            !all.iter().any(|s| s.name == "n0"),
            "the oldest was evicted"
        );
        assert!(all.iter().any(|s| s.id == new.id));
        let err = store
            .add_source("more", cfg("sdr", Some("more"), &[]), &sdr, |_| false)
            .unwrap_err();
        assert!(err.contains("At most"));
    }

    // ---- update_source ----

    fn update(name: &str, device: Option<&str>, conn: &[(&str, &str)]) -> SourceUpdate {
        SourceUpdate {
            name: name.into(),
            device_id: device.map(Into::into),
            connection: cfg("x", None, conn).connection,
        }
    }

    #[test]
    fn update_source_renames_rebinds_and_keeps_use_and_settings() {
        let (dir, store) = new_store();
        let sdr = sdr_driver();
        let rec = store
            .remember_connected(
                None,
                &active("sdr", Some("S1"), "SDR S1", 100e6),
                all_available,
            )
            .unwrap();
        let before_settings = rec.config.settings.clone();
        std::thread::sleep(std::time::Duration::from_millis(2));
        // Rename and update the port hint.
        let u = store
            .update_source(
                &rec.id,
                &update("Bench", None, &[("port", "/dev/ttyACM5")]),
                &sdr,
                false,
            )
            .unwrap();
        assert_eq!(u.name, "Bench");
        assert_eq!(u.config.device_id.as_deref(), Some("S1"));
        assert_eq!(
            u.config.connection.get("port"),
            Some(&ParamValue::Text("/dev/ttyACM5".into()))
        );
        assert_eq!(u.config.settings, before_settings);
        assert_eq!(u.last_used_ms, rec.last_used_ms, "not a use");
        assert_eq!(u.created_ms, rec.created_ms);
        assert!(u.updated_ms > rec.updated_ms);
        assert_eq!(u.label, "SDR S1");
        // Rebind to a free serial.
        let u = store
            .update_source(
                &rec.id,
                &update("Bench", Some("S2"), &[("port", "/dev/ttyACM5")]),
                &sdr,
                false,
            )
            .unwrap();
        assert_eq!(u.config.device_id.as_deref(), Some("S2"));
        assert_eq!(ConfigStore::open(dir.path()).sources_all(), vec![u]);
    }

    #[test]
    fn update_source_rejects_a_serial_owned_by_another_record() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        store
            .add_source("Lab", cfg("sdr", Some("S1"), &[]), &sdr, all_available)
            .unwrap();
        let other = store
            .add_source("Bench", cfg("sdr", Some("S2"), &[]), &sdr, all_available)
            .unwrap();
        let err = store
            .update_source(&other.id, &update("Bench", Some("S1"), &[]), &sdr, false)
            .unwrap_err();
        assert_eq!(err, "This device is already in Your sources as \"Lab\".");
        // Own name is not a collision; another record's is.
        assert!(
            store
                .update_source(&other.id, &update("bench", None, &[]), &sdr, false)
                .is_ok()
        );
        let err = store
            .update_source(&other.id, &update("LAB", None, &[]), &sdr, false)
            .unwrap_err();
        assert_eq!(err, "The name \"LAB\" is already used by another source.");
    }

    #[test]
    fn update_source_lock_allows_rename_but_not_connection_changes() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        let rec = store
            .add_source(
                "Bench",
                cfg("sdr", Some("S1"), &[("port", "/dev/a")]),
                &sdr,
                all_available,
            )
            .unwrap();
        let locked = "Disconnect first to change the connection settings.";
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update("Bench", None, &[("port", "/dev/b")]),
                    &sdr,
                    true
                )
                .unwrap_err(),
            locked
        );
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update("Bench", Some("S2"), &[("port", "/dev/a")]),
                    &sdr,
                    true
                )
                .unwrap_err(),
            locked
        );
        let renamed = store
            .update_source(
                &rec.id,
                &update("New", None, &[("port", "/dev/a")]),
                &sdr,
                true,
            )
            .unwrap();
        assert_eq!(renamed.name, "New");
        // Sending the same identity explicitly is not a change.
        assert!(
            store
                .update_source(
                    &rec.id,
                    &update("New", Some("S1"), &[("port", "/dev/a")]),
                    &sdr,
                    true
                )
                .is_ok()
        );
    }

    #[test]
    fn update_source_simulator_and_file_are_rename_only() {
        let (_dir, store) = new_store();
        let sim = kind_driver("sim", SourceKind::Simulator);
        let file = kind_driver("file", SourceKind::File);
        let s = store
            .remember_connected(
                None,
                &active("sim", None, "Built-in simulator", 1e6),
                all_available,
            )
            .unwrap();
        let mut file_active = active("file", None, "rec.sigmf", 1e6);
        file_active.config.connection = cfg("file", None, &[("path", "/tmp/a")]).connection;
        let f = store
            .remember_connected(None, &file_active, all_available)
            .unwrap();
        assert_eq!(
            store
                .update_source(&s.id, &update("Sim", None, &[]), &sim, false)
                .unwrap()
                .name,
            "Sim"
        );
        assert_eq!(
            store
                .update_source(&s.id, &update("Sim", None, &[("a", "b")]), &sim, false)
                .unwrap_err(),
            "The simulator has no settings."
        );
        assert_eq!(
            store
                .update_source(&s.id, &update("Sim", Some("x"), &[]), &sim, false)
                .unwrap_err(),
            "The simulator has no settings."
        );
        let same = update("Recording", None, &[("path", "/tmp/a")]);
        assert_eq!(
            store
                .update_source(&f.id, &same, &file, false)
                .unwrap()
                .name,
            "Recording"
        );
        assert_eq!(
            store
                .update_source(
                    &f.id,
                    &update("Recording", None, &[("path", "/tmp/b")]),
                    &file,
                    false
                )
                .unwrap_err(),
            "The file cannot be changed."
        );
    }

    #[test]
    fn update_source_other_errors() {
        let (_dir, store) = new_store();
        let sdr = sdr_driver();
        let manual = sdr_no_discovery();
        assert_eq!(
            store
                .update_source("nope", &update("x", None, &[]), &sdr, false)
                .unwrap_err(),
            "That source no longer exists."
        );
        let rec = store
            .add_source(
                "Typed",
                cfg("sdr", None, &[("port", "/dev/a")]),
                &manual,
                all_available,
            )
            .unwrap();
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update(" ", None, &[("port", "/dev/a")]),
                    &manual,
                    false
                )
                .unwrap_err(),
            "Enter a name."
        );
        // A no-id record on a discovery driver cannot lose its port.
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update("Typed", None, &[("port", "")]),
                    &sdr,
                    false
                )
                .unwrap_err(),
            "Port is required."
        );
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update("Typed", None, &[("zz", "1")]),
                    &manual,
                    false
                )
                .unwrap_err(),
            "Unknown parameter \"zz\"."
        );
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update("Typed", None, &[("port", "/dev/a")]),
                    &driver("sdr", DriverStatus::Planned),
                    false
                )
                .unwrap_err(),
            "That source type is not available."
        );
        // Editing the port of a no-id record onto another's port is a duplicate identity.
        store
            .add_source(
                "Other",
                cfg("sdr", None, &[("port", "/dev/b")]),
                &manual,
                all_available,
            )
            .unwrap();
        assert_eq!(
            store
                .update_source(
                    &rec.id,
                    &update("Typed", None, &[("port", "/dev/b")]),
                    &manual,
                    false
                )
                .unwrap_err(),
            "This device is already in Your sources as \"Other\"."
        );
    }
}
