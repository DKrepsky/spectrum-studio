//! Human-readable rendering of values (frequencies) for user-facing messages.

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

#[cfg(test)]
mod tests {
    use super::hz;

    #[test]
    fn formats_with_prefixes() {
        assert_eq!(hz(100_200_000.0), "100.2 MHz");
        assert_eq!(hz(2_400_000_000.0), "2.4 GHz");
        assert_eq!(hz(12_500.0), "12.5 kHz");
        assert_eq!(hz(50.0), "50 Hz");
        assert_eq!(hz(-1_000_000.0), "-1 MHz");
    }
}
