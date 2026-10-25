//! Spectrum traces as CSV.
//!
//! Export layout: `#`-prefixed `key,value` metadata lines, one header row, then one row per bin:
//!
//! ```text
//! # Spectrum Studio spectrum export
//! # format_version,1
//! # unit,dBFS
//! ...
//! frequency_hz,live_dBFS,max_hold_dBFS
//! 98976000.000,-84.512,-80.101
//! ```
//!
//! Import accepts this format and generic two-or-more-column CSV (`frequency, level`) with an
//! optional header; frequencies must be evenly spaced.

use std::io::{BufRead, Write};

use super::FormatError;
use crate::format::iso8601_utc;
use crate::model::session::now_ms;
use crate::model::{AmplitudeUnit, DataKind, SpectrumFrame, TraceKind, WindowKind};

pub const CSV_FORMAT_VERSION: u32 = 1;
/// Upper bound on imported points, to reject unreasonable files early.
pub const MAX_IMPORT_POINTS: usize = 1_000_000;

fn trace_column(kind: TraceKind) -> &'static str {
    match kind {
        TraceKind::Live => "live",
        TraceKind::MaxHold => "max_hold",
        TraceKind::MinHold => "min_hold",
    }
}

fn window_name(w: WindowKind) -> &'static str {
    match w {
        WindowKind::Rectangular => "rectangular",
        WindowKind::Hann => "hann",
        WindowKind::BlackmanHarris => "blackman-harris",
        WindowKind::FlatTop => "flat-top",
    }
}

/// Writes `frame` as CSV with full measurement metadata.
pub fn write_spectrum_csv(frame: &SpectrumFrame, out: &mut impl Write) -> std::io::Result<()> {
    let h = &frame.header;
    let unit = h.unit.symbol();
    let mut meta: Vec<(&str, String)> = vec![
        ("format_version", CSV_FORMAT_VERSION.to_string()),
        ("exported_at", iso8601_utc(now_ms())),
        ("measured_at", iso8601_utc(h.timestamp_ms)),
        ("source", h.source_label.replace([',', '\n', '\r'], " ")),
        ("simulated", h.simulated.to_string()),
        (
            "data_kind",
            match h.data_kind {
                DataKind::Iq => "iq".into(),
                DataKind::Trace => "trace".into(),
            },
        ),
        ("unit", unit.into()),
        ("calibrated", h.unit.is_calibrated().to_string()),
        ("center_hz", format!("{:.3}", h.center_hz)),
        ("span_hz", format!("{:.3}", h.span_hz)),
        ("bin_spacing_hz", format!("{:.6}", h.bin_hz)),
        ("points", frame.live.len().to_string()),
    ];
    if let Some(rbw) = h.rbw_hz {
        meta.push(("rbw_hz", format!("{rbw:.6}")));
    }
    if let Some(n) = h.fft_size {
        meta.push(("fft_size", n.to_string()));
    }
    if let Some(w) = h.window {
        meta.push(("window", window_name(w).into()));
    }
    meta.push((
        "averaging",
        format!("{} of {}", h.averaged_count, h.averaging),
    ));
    if let Some(floor) = h.noise_floor {
        meta.push(("noise_floor", format!("{floor:.3}")));
    }

    writeln!(out, "# Spectrum Studio spectrum export")?;
    for (k, v) in meta {
        writeln!(out, "# {k},{v}")?;
    }
    let traces = frame.traces();
    write!(out, "frequency_hz")?;
    for (kind, _) in &traces {
        write!(out, ",{}_{unit}", trace_column(*kind))?;
    }
    writeln!(out)?;
    for i in 0..frame.live.len() {
        write!(out, "{:.3}", frame.frequency_of(i))?;
        for (_, t) in &traces {
            write!(out, ",{:.3}", t[i])?;
        }
        writeln!(out)?;
    }
    Ok(())
}

/// A trace read from CSV.
#[derive(Debug, Clone, PartialEq)]
pub struct ImportedTrace {
    pub values: Vec<f32>,
    pub start_hz: f64,
    pub bin_hz: f64,
    /// Unit found in the file (header or metadata), if any.
    pub unit: Option<AmplitudeUnit>,
    pub rbw_hz: Option<f64>,
}

/// Reads a spectrum trace from CSV (see module docs). Uses the first level column.
pub fn read_spectrum_csv(input: impl BufRead) -> Result<ImportedTrace, FormatError> {
    let mut unit = None;
    let mut rbw_hz = None;
    let mut freqs: Vec<f64> = Vec::new();
    let mut values: Vec<f32> = Vec::new();
    let mut header_seen = false;

    for (index, line) in input.lines().enumerate() {
        let line = line?;
        let line_no = index + 1;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(meta) = line.strip_prefix('#') {
            if let Some((key, value)) = meta.trim().split_once(',') {
                match key.trim() {
                    "unit" => unit = AmplitudeUnit::from_symbol(value),
                    "rbw_hz" => rbw_hz = value.trim().parse().ok(),
                    _ => {}
                }
            }
            continue;
        }
        let fields: Vec<&str> = line.split([',', ';', '\t']).map(str::trim).collect();
        if fields.len() < 2 {
            return Err(FormatError::Invalid(format!(
                "Line {line_no}: expected at least two columns (frequency and level)."
            )));
        }
        let parsed = (fields[0].parse::<f64>(), fields[1].parse::<f32>());
        match parsed {
            (Ok(f), Ok(v)) if f.is_finite() && v.is_finite() => {
                freqs.push(f);
                values.push(v);
                if values.len() > MAX_IMPORT_POINTS {
                    return Err(FormatError::Invalid(format!(
                        "The file has more than {MAX_IMPORT_POINTS} points."
                    )));
                }
            }
            _ if !header_seen && values.is_empty() => {
                header_seen = true;
                // Header such as "frequency_hz,live_dBm": take the unit from the level column.
                if unit.is_none() {
                    unit = fields[1]
                        .rsplit(['_', ' ', '('])
                        .next()
                        .map(|s| s.trim_end_matches(')'))
                        .and_then(AmplitudeUnit::from_symbol);
                }
            }
            _ => {
                return Err(FormatError::Invalid(format!(
                    "Line {line_no}: \"{}\" is not a valid frequency/level pair.",
                    line.chars().take(60).collect::<String>()
                )));
            }
        }
    }

    if values.len() < 2 {
        return Err(FormatError::Invalid(
            "The file must contain at least two data rows.".into(),
        ));
    }
    let start_hz = freqs[0];
    let bin_hz = (freqs[freqs.len() - 1] - start_hz) / (freqs.len() - 1) as f64;
    if bin_hz <= 0.0 {
        return Err(FormatError::Invalid(
            "Frequencies must increase from row to row.".into(),
        ));
    }
    let tolerance = bin_hz * 1e-3;
    if let Some(i) = freqs
        .iter()
        .enumerate()
        .position(|(i, f)| (f - (start_hz + i as f64 * bin_hz)).abs() > tolerance)
    {
        return Err(FormatError::Unsupported(format!(
            "Frequencies must be evenly spaced; row {} breaks the spacing of {} Hz.",
            i + 1,
            bin_hz
        )));
    }
    Ok(ImportedTrace {
        values,
        start_hz,
        bin_hz,
        unit,
        rbw_hz,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::frame::tests::sample_frame;

    #[test]
    fn export_contains_metadata_header_and_rows() {
        let frame = sample_frame();
        let mut out = Vec::new();
        write_spectrum_csv(&frame, &mut out).unwrap();
        let text = String::from_utf8(out).unwrap();
        assert!(text.starts_with("# Spectrum Studio spectrum export\n"));
        for expected in [
            "# unit,dBFS",
            "# calibrated,false",
            "# simulated,true",
            "# center_hz,100000000.000",
            "# fft_size,4",
            "# window,hann",
            "# rbw_hz,750000.000000",
            "frequency_hz,live_dBFS,max_hold_dBFS",
            "99000000.000,-80.000,-70.000",
            "100000000.000,-20.000,-19.000",
        ] {
            assert!(text.contains(expected), "missing {expected:?} in\n{text}");
        }
        assert_eq!(text.lines().filter(|l| !l.starts_with('#')).count(), 5);
    }

    #[test]
    fn export_round_trips_through_import() {
        let frame = sample_frame();
        let mut out = Vec::new();
        write_spectrum_csv(&frame, &mut out).unwrap();
        let trace = read_spectrum_csv(out.as_slice()).unwrap();
        assert_eq!(trace.values, frame.live);
        assert_eq!(trace.start_hz, frame.header.start_hz);
        assert_eq!(trace.bin_hz, frame.header.bin_hz);
        assert_eq!(trace.unit, Some(AmplitudeUnit::Dbfs));
        assert_eq!(trace.rbw_hz, Some(750_000.0));
    }

    #[test]
    fn imports_generic_csv_and_detects_unit_from_header() {
        let csv = "Frequency (Hz);Level (dBm)\n1000000;-50.5\n1001000;-40\n1002000;-60\n";
        let trace = read_spectrum_csv(csv.as_bytes()).unwrap();
        assert_eq!(trace.unit, Some(AmplitudeUnit::Dbm));
        assert_eq!(trace.bin_hz, 1000.0);
        let no_header = "1,2\n2,3\n";
        assert_eq!(read_spectrum_csv(no_header.as_bytes()).unwrap().unit, None);
    }

    #[test]
    fn rejects_invalid_files_with_helpful_messages() {
        let cases = [
            ("", "at least two data rows"),
            ("f,l\n1,2\n", "at least two data rows"),
            ("1,2\n2,x\n", "Line 2"),
            ("1\n", "at least two columns"),
            ("3,1\n2,1\n1,1\n", "increase"),
            ("1,0\n2,0\n10,0\n", "evenly spaced"),
        ];
        for (input, message) in cases {
            let err = read_spectrum_csv(input.as_bytes()).unwrap_err().to_string();
            assert!(err.contains(message), "{input:?}: {err}");
        }
    }
}
