use serde::{Deserialize, Serialize};

/// Unit of the amplitude axis.
///
/// IQ-derived spectra are relative to the converter's full scale (`Dbfs`) unless a calibration
/// is applied. Only `Dbm` denotes an absolute, calibrated power.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "bindings", ts(export))]
pub enum AmplitudeUnit {
    /// Decibels relative to full scale: a complex sinusoid with magnitude 1.0 reads 0 dBFS.
    Dbfs,
    /// Decibels relative to 1 mW into the instrument's reference impedance (calibrated).
    Dbm,
    /// Relative decibels with no known reference (uncalibrated).
    Db,
}

impl AmplitudeUnit {
    pub fn symbol(self) -> &'static str {
        match self {
            Self::Dbfs => "dBFS",
            Self::Dbm => "dBm",
            Self::Db => "dB",
        }
    }

    pub fn is_calibrated(self) -> bool {
        matches!(self, Self::Dbm)
    }

    pub fn from_symbol(symbol: &str) -> Option<Self> {
        match symbol.trim().to_ascii_lowercase().as_str() {
            "dbfs" => Some(Self::Dbfs),
            "dbm" => Some(Self::Dbm),
            "db" => Some(Self::Db),
            _ => None,
        }
    }
}

/// Converts a power level in decibels to a linear power ratio.
pub fn db_to_power(db: f32) -> f32 {
    10f32.powf(db / 10.0)
}

/// Converts a linear power ratio to decibels, clamped to avoid `-inf` for zero power.
pub fn power_to_db(power: f32) -> f32 {
    10.0 * power.max(1e-30).log10()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn symbols_round_trip() {
        for unit in [AmplitudeUnit::Dbfs, AmplitudeUnit::Dbm, AmplitudeUnit::Db] {
            assert_eq!(AmplitudeUnit::from_symbol(unit.symbol()), Some(unit));
        }
        assert_eq!(AmplitudeUnit::from_symbol("V"), None);
    }

    #[test]
    fn only_dbm_is_calibrated() {
        assert!(AmplitudeUnit::Dbm.is_calibrated());
        assert!(!AmplitudeUnit::Dbfs.is_calibrated());
        assert!(!AmplitudeUnit::Db.is_calibrated());
    }

    #[test]
    fn db_conversions_are_inverse() {
        for db in [-120.0f32, -3.0, 0.0, 10.0] {
            assert!((power_to_db(db_to_power(db)) - db).abs() < 1e-4);
        }
        assert_eq!(power_to_db(0.0), -300.0);
    }
}
