//! Generic, self-describing source parameters.
//!
//! Drivers describe device-specific settings with [`ParamSpec`]s; the UI renders them as a form
//! and the core validates submitted values against the same specs.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A parameter value as submitted by the UI or stored in a configuration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(untagged)]
#[ts(export)]
pub enum ParamValue {
    Bool(bool),
    Number(f64),
    Text(String),
}

pub type ParamMap = BTreeMap<String, ParamValue>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ChoiceOption {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
#[ts(export)]
pub enum ParamKind {
    Number {
        min: f64,
        max: f64,
        step: f64,
        unit: Option<String>,
    },
    Choice {
        options: Vec<ChoiceOption>,
    },
    Bool,
    Text {
        max_length: u32,
    },
    /// A filesystem path chosen with a native file dialog.
    Path {
        /// File extensions offered by the dialog filter (without dots).
        extensions: Vec<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ParamSpec {
    pub id: String,
    pub label: String,
    /// Optional section heading used to group related parameters in forms.
    pub group: Option<String>,
    pub help: Option<String>,
    pub kind: ParamKind,
    pub default: ParamValue,
    /// Required parameters must be provided explicitly (their default is only a placeholder).
    pub required: bool,
}

impl ParamSpec {
    pub fn number(id: &str, label: &str, min: f64, max: f64, step: f64, default: f64) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            group: None,
            help: None,
            kind: ParamKind::Number {
                min,
                max,
                step,
                unit: None,
            },
            default: ParamValue::Number(default),
            required: false,
        }
    }

    pub fn boolean(id: &str, label: &str, default: bool) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            group: None,
            help: None,
            kind: ParamKind::Bool,
            default: ParamValue::Bool(default),
            required: false,
        }
    }

    pub fn choice(id: &str, label: &str, options: &[(&str, &str)], default: &str) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            group: None,
            help: None,
            kind: ParamKind::Choice {
                options: options
                    .iter()
                    .map(|(value, label)| ChoiceOption {
                        value: (*value).into(),
                        label: (*label).into(),
                    })
                    .collect(),
            },
            default: ParamValue::Text(default.into()),
            required: false,
        }
    }

    pub fn path(id: &str, label: &str, extensions: &[&str]) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            group: None,
            help: None,
            kind: ParamKind::Path {
                extensions: extensions.iter().map(|e| (*e).into()).collect(),
            },
            default: ParamValue::Text(String::new()),
            required: true,
        }
    }

    pub fn with_unit(mut self, unit: &str) -> Self {
        if let ParamKind::Number { unit: u, .. } = &mut self.kind {
            *u = Some(unit.into());
        }
        self
    }

    pub fn in_group(mut self, group: &str) -> Self {
        self.group = Some(group.into());
        self
    }

    pub fn with_help(mut self, help: &str) -> Self {
        self.help = Some(help.into());
        self
    }

    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }

    /// Checks a single value against this spec and returns the normalised value.
    pub fn check(&self, value: &ParamValue) -> Result<ParamValue, String> {
        match (&self.kind, value) {
            (ParamKind::Number { min, max, .. }, ParamValue::Number(n)) => {
                if !n.is_finite() {
                    Err(format!("{} must be a finite number.", self.label))
                } else if n < min || n > max {
                    Err(format!(
                        "{} must be between {} and {} (got {}).",
                        self.label, min, max, n
                    ))
                } else {
                    Ok(ParamValue::Number(*n))
                }
            }
            (ParamKind::Choice { options }, ParamValue::Text(t)) => {
                if options.iter().any(|o| &o.value == t) {
                    Ok(value.clone())
                } else {
                    Err(format!("{} has no option \"{}\".", self.label, t))
                }
            }
            (ParamKind::Bool, ParamValue::Bool(_)) => Ok(value.clone()),
            (ParamKind::Text { max_length }, ParamValue::Text(t)) => {
                if t.chars().count() > *max_length as usize {
                    Err(format!(
                        "{} is longer than {} characters.",
                        self.label, max_length
                    ))
                } else {
                    Ok(value.clone())
                }
            }
            (ParamKind::Path { .. }, ParamValue::Text(t)) => {
                if t.trim().is_empty() {
                    Err(format!("{} is required.", self.label))
                } else {
                    Ok(value.clone())
                }
            }
            _ => Err(format!("{} has the wrong type of value.", self.label)),
        }
    }
}

/// Validates `values` against `specs`.
///
/// Unknown keys and invalid values are rejected. Missing optional parameters are filled with
/// their defaults; missing required parameters are an error.
pub fn resolve_params(specs: &[ParamSpec], values: &ParamMap) -> Result<ParamMap, String> {
    if let Some(unknown) = values.keys().find(|k| !specs.iter().any(|s| &s.id == *k)) {
        return Err(format!("Unknown parameter \"{unknown}\"."));
    }
    let mut resolved = ParamMap::new();
    for spec in specs {
        let value = match values.get(&spec.id) {
            Some(v) => spec.check(v)?,
            None if spec.required => return Err(format!("{} is required.", spec.label)),
            None => spec.default.clone(),
        };
        resolved.insert(spec.id.clone(), value);
    }
    Ok(resolved)
}

/// Validates a partial update: only the provided keys are checked.
pub fn check_partial(specs: &[ParamSpec], values: &ParamMap) -> Result<(), String> {
    for (key, value) in values {
        let spec = specs
            .iter()
            .find(|s| &s.id == key)
            .ok_or_else(|| format!("Unknown parameter \"{key}\"."))?;
        spec.check(value)?;
    }
    Ok(())
}

/// Typed accessors for resolved parameter maps.
pub trait ParamMapExt {
    fn number(&self, id: &str) -> Option<f64>;
    fn flag(&self, id: &str) -> Option<bool>;
    fn text(&self, id: &str) -> Option<&str>;
}

impl ParamMapExt for ParamMap {
    fn number(&self, id: &str) -> Option<f64> {
        match self.get(id) {
            Some(ParamValue::Number(n)) => Some(*n),
            _ => None,
        }
    }

    fn flag(&self, id: &str) -> Option<bool> {
        match self.get(id) {
            Some(ParamValue::Bool(b)) => Some(*b),
            _ => None,
        }
    }

    fn text(&self, id: &str) -> Option<&str> {
        match self.get(id) {
            Some(ParamValue::Text(t)) => Some(t),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn specs() -> Vec<ParamSpec> {
        vec![
            ParamSpec::number("gain", "Gain", 0.0, 50.0, 1.0, 20.0),
            ParamSpec::boolean("agc", "AGC", false),
            ParamSpec::choice("mode", "Mode", &[("a", "A"), ("b", "B")], "a"),
            ParamSpec::path("file", "File", &["cf32"]),
        ]
    }

    fn map(entries: &[(&str, ParamValue)]) -> ParamMap {
        entries
            .iter()
            .map(|(k, v)| ((*k).to_string(), v.clone()))
            .collect()
    }

    #[test]
    fn fills_defaults_and_requires_required() {
        let err = resolve_params(&specs(), &ParamMap::new()).unwrap_err();
        assert_eq!(err, "File is required.");

        let resolved =
            resolve_params(&specs(), &map(&[("file", ParamValue::Text("x".into()))])).unwrap();
        assert_eq!(resolved.number("gain"), Some(20.0));
        assert_eq!(resolved.flag("agc"), Some(false));
        assert_eq!(resolved.text("mode"), Some("a"));
    }

    #[test]
    fn rejects_out_of_range_wrong_type_and_unknown() {
        let s = specs();
        let base = [("file", ParamValue::Text("x".into()))];
        let mut m = map(&base);
        m.insert("gain".into(), ParamValue::Number(51.0));
        assert!(
            resolve_params(&s, &m)
                .unwrap_err()
                .contains("between 0 and 50")
        );

        let mut m = map(&base);
        m.insert("agc".into(), ParamValue::Number(1.0));
        assert!(resolve_params(&s, &m).unwrap_err().contains("wrong type"));

        let mut m = map(&base);
        m.insert("mode".into(), ParamValue::Text("c".into()));
        assert!(resolve_params(&s, &m).unwrap_err().contains("no option"));

        let mut m = map(&base);
        m.insert("bogus".into(), ParamValue::Bool(true));
        assert!(resolve_params(&s, &m).unwrap_err().contains("Unknown"));

        let mut m = map(&base);
        m.insert("gain".into(), ParamValue::Number(f64::NAN));
        assert!(resolve_params(&s, &m).unwrap_err().contains("finite"));
    }

    #[test]
    fn partial_checks_only_given_keys() {
        assert!(check_partial(&specs(), &map(&[("gain", ParamValue::Number(3.0))])).is_ok());
        assert!(check_partial(&specs(), &map(&[("gain", ParamValue::Number(-1.0))])).is_err());
    }

    #[test]
    fn untagged_values_deserialize_from_plain_json() {
        let m: ParamMap = serde_json::from_str(r#"{"a":true,"b":1.5,"c":"x"}"#).unwrap();
        assert_eq!(m["a"], ParamValue::Bool(true));
        assert_eq!(m["b"], ParamValue::Number(1.5));
        assert_eq!(m["c"], ParamValue::Text("x".into()));
    }
}
