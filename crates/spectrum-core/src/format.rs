//! Human-readable formatting for user-facing messages.

/// Formats a frequency with an SI prefix, e.g. `100.2 MHz`.
pub fn hz(value: f64) -> String {
    let abs = value.abs();
    let (scale, unit) = if abs >= 1e9 {
        (1e9, "GHz")
    } else if abs >= 1e6 {
        (1e6, "MHz")
    } else if abs >= 1e3 {
        (1e3, "kHz")
    } else {
        (1.0, "Hz")
    };
    let scaled = format!("{:.6}", value / scale);
    let trimmed = scaled.trim_end_matches('0').trim_end_matches('.');
    format!("{trimmed} {unit}")
}

/// Formats a Unix timestamp in milliseconds as ISO 8601 UTC, e.g. `2026-10-25T14:30:16.250Z`.
pub fn iso8601_utc(ms: f64) -> String {
    let total_ms = ms.max(0.0) as i64;
    let (days, ms_of_day) = (
        total_ms.div_euclid(86_400_000),
        total_ms.rem_euclid(86_400_000),
    );
    // Civil-from-days (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    let s = ms_of_day / 1000;
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        s / 3600,
        s / 60 % 60,
        s % 60,
        ms_of_day % 1000
    )
}

#[cfg(test)]
mod tests {
    use super::{hz, iso8601_utc};

    #[test]
    fn formats_utc_timestamps() {
        assert_eq!(iso8601_utc(0.0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso8601_utc(951_782_400_000.0), "2000-02-29T00:00:00.000Z");
        assert_eq!(iso8601_utc(1_793_017_816_250.0), "2026-10-26T12:30:16.250Z");
    }

    #[test]
    fn formats_with_prefixes() {
        assert_eq!(hz(100_200_000.0), "100.2 MHz");
        assert_eq!(hz(2_400_000_000.0), "2.4 GHz");
        assert_eq!(hz(12_500.0), "12.5 kHz");
        assert_eq!(hz(50.0), "50 Hz");
        assert_eq!(hz(-1_000_000.0), "-1 MHz");
    }
}
