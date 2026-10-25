//! IQ recordings: raw interleaved sample files and SigMF (metadata + data file pairs).
//!
//! Supported sample formats (little-endian, interleaved I/Q):
//!
//! | Format | SigMF datatype | Common extensions | Scaling to ±1.0 full scale |
//! | --- | --- | --- | --- |
//! | `cf32` | `cf32_le` | `.cf32`, `.cfile`, `.fc32` | as stored |
//! | `cs16` | `ci16_le` | `.cs16`, `.sc16` | ÷ 32768 |
//! | `cu8` | `cu8` | `.cu8` (rtl_sdr) | (x − 127.5) ÷ 127.5 |
//! | `cs8` | `ci8` | `.cs8`, `.sc8` (HackRF) | ÷ 128 |

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use rustfft::num_complex::Complex32;
use serde_json::Value;

use super::FormatError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SampleFormat {
    Cf32,
    Cs16,
    Cu8,
    Cs8,
}

impl SampleFormat {
    pub const ALL: [SampleFormat; 4] = [Self::Cf32, Self::Cs16, Self::Cu8, Self::Cs8];

    pub fn id(self) -> &'static str {
        match self {
            Self::Cf32 => "cf32",
            Self::Cs16 => "cs16",
            Self::Cu8 => "cu8",
            Self::Cs8 => "cs8",
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|f| f.id() == id)
    }

    /// Bytes per complex sample.
    pub fn sample_bytes(self) -> usize {
        match self {
            Self::Cf32 => 8,
            Self::Cs16 => 4,
            Self::Cu8 | Self::Cs8 => 2,
        }
    }

    pub fn from_extension(path: &Path) -> Option<Self> {
        let ext = path.extension()?.to_str()?.to_ascii_lowercase();
        match ext.as_str() {
            "cf32" | "cfile" | "fc32" => Some(Self::Cf32),
            "cs16" | "sc16" => Some(Self::Cs16),
            "cu8" => Some(Self::Cu8),
            "cs8" | "sc8" => Some(Self::Cs8),
            _ => None,
        }
    }

    pub fn from_sigmf_datatype(datatype: &str) -> Option<Self> {
        match datatype {
            "cf32_le" => Some(Self::Cf32),
            "ci16_le" => Some(Self::Cs16),
            "cu8" => Some(Self::Cu8),
            "ci8" => Some(Self::Cs8),
            _ => None,
        }
    }

    /// Decodes whole samples from `bytes` into `out` (cleared first).
    pub fn decode(self, bytes: &[u8], out: &mut Vec<Complex32>) {
        out.clear();
        let n = bytes.len() / self.sample_bytes();
        out.reserve(n);
        match self {
            Self::Cf32 => {
                for c in bytes.chunks_exact(8) {
                    let re = f32::from_le_bytes([c[0], c[1], c[2], c[3]]);
                    let im = f32::from_le_bytes([c[4], c[5], c[6], c[7]]);
                    out.push(Complex32::new(re, im));
                }
            }
            Self::Cs16 => {
                for c in bytes.chunks_exact(4) {
                    let re = f32::from(i16::from_le_bytes([c[0], c[1]])) / 32768.0;
                    let im = f32::from(i16::from_le_bytes([c[2], c[3]])) / 32768.0;
                    out.push(Complex32::new(re, im));
                }
            }
            Self::Cu8 => {
                for c in bytes.chunks_exact(2) {
                    out.push(Complex32::new(
                        (f32::from(c[0]) - 127.5) / 127.5,
                        (f32::from(c[1]) - 127.5) / 127.5,
                    ));
                }
            }
            Self::Cs8 => {
                for c in bytes.chunks_exact(2) {
                    out.push(Complex32::new(
                        f32::from(c[0] as i8) / 128.0,
                        f32::from(c[1] as i8) / 128.0,
                    ));
                }
            }
        }
    }
}

/// Everything needed to replay a recording.
#[derive(Debug, Clone, PartialEq)]
pub struct RecordingInfo {
    pub data_path: PathBuf,
    pub format: SampleFormat,
    pub sample_rate_hz: f64,
    pub center_hz: f64,
    /// Byte offset of the first sample in the data file.
    pub data_offset: u64,
    pub total_samples: u64,
}

pub fn is_sigmf(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).is_some_and(|e| {
        e.eq_ignore_ascii_case("sigmf-meta") || e.eq_ignore_ascii_case("sigmf-data")
    })
}

fn count_samples(path: &Path, offset: u64, format: SampleFormat) -> Result<u64, FormatError> {
    let len = std::fs::metadata(path)?.len();
    let samples = len.saturating_sub(offset) / format.sample_bytes() as u64;
    if samples == 0 {
        return Err(FormatError::Invalid(format!(
            "{} contains no samples.",
            path.display()
        )));
    }
    Ok(samples)
}

/// Describes a raw recording whose parameters are supplied by the user.
pub fn raw_recording(
    path: &Path,
    format: SampleFormat,
    sample_rate_hz: f64,
    center_hz: f64,
) -> Result<RecordingInfo, FormatError> {
    if !(sample_rate_hz.is_finite() && sample_rate_hz > 0.0) {
        return Err(FormatError::Invalid(
            "Raw IQ files carry no metadata: enter the recording's sample rate.".into(),
        ));
    }
    Ok(RecordingInfo {
        data_path: path.to_path_buf(),
        format,
        sample_rate_hz,
        center_hz,
        data_offset: 0,
        total_samples: count_samples(path, 0, format)?,
    })
}

/// Reads a SigMF recording given either its `.sigmf-meta` or `.sigmf-data` file.
pub fn sigmf_recording(path: &Path) -> Result<RecordingInfo, FormatError> {
    let meta_path = path.with_extension("sigmf-meta");
    let data_path = path.with_extension("sigmf-data");
    let text = std::fs::read_to_string(&meta_path).map_err(|e| {
        FormatError::Invalid(format!(
            "Could not read SigMF metadata {}: {e}",
            meta_path.display()
        ))
    })?;
    let meta: Value = serde_json::from_str(&text)
        .map_err(|e| FormatError::Invalid(format!("SigMF metadata is not valid JSON: {e}")))?;
    let global = meta
        .get("global")
        .ok_or_else(|| FormatError::Invalid("SigMF metadata has no \"global\" object.".into()))?;
    let datatype = global
        .get("core:datatype")
        .and_then(Value::as_str)
        .ok_or_else(|| FormatError::Invalid("SigMF metadata has no core:datatype.".into()))?;
    let format = SampleFormat::from_sigmf_datatype(datatype).ok_or_else(|| {
        FormatError::Unsupported(format!(
            "SigMF datatype \"{datatype}\" is not supported (supported: cf32_le, ci16_le, cu8, ci8)."
        ))
    })?;
    let sample_rate_hz = global
        .get("core:sample_rate")
        .and_then(Value::as_f64)
        .filter(|r| r.is_finite() && *r > 0.0)
        .ok_or_else(|| {
            FormatError::Invalid("SigMF metadata has no valid core:sample_rate.".into())
        })?;
    let capture = meta
        .get("captures")
        .and_then(Value::as_array)
        .and_then(|c| c.first());
    let center_hz = capture
        .and_then(|c| c.get("core:frequency"))
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let sample_start = capture
        .and_then(|c| c.get("core:sample_start"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let data_offset = sample_start * format.sample_bytes() as u64;
    if !data_path.exists() {
        return Err(FormatError::Invalid(format!(
            "The SigMF data file {} is missing.",
            data_path.display()
        )));
    }
    Ok(RecordingInfo {
        total_samples: count_samples(&data_path, data_offset, format)?,
        data_path,
        format,
        sample_rate_hz,
        center_hz,
        data_offset,
    })
}

/// Random-access reader of samples from a recording.
pub struct RecordingReader {
    info: RecordingInfo,
    file: File,
    bytes: Vec<u8>,
}

impl RecordingReader {
    pub fn open(info: RecordingInfo) -> Result<Self, FormatError> {
        let file = File::open(&info.data_path)?;
        Ok(Self {
            info,
            file,
            bytes: Vec::new(),
        })
    }

    pub fn info(&self) -> &RecordingInfo {
        &self.info
    }

    /// Reads up to `count` samples starting at sample index `start` into `out`.
    pub fn read_at(
        &mut self,
        start: u64,
        count: usize,
        out: &mut Vec<Complex32>,
    ) -> Result<(), FormatError> {
        let available = self.info.total_samples.saturating_sub(start);
        let count = count.min(usize::try_from(available).unwrap_or(usize::MAX));
        let size = self.info.format.sample_bytes();
        self.bytes.resize(count * size, 0);
        self.file
            .seek(SeekFrom::Start(self.info.data_offset + start * size as u64))?;
        self.file.read_exact(&mut self.bytes)?;
        self.info.format.decode(&self.bytes, out);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write(path: &Path, bytes: &[u8]) {
        std::fs::File::create(path)
            .unwrap()
            .write_all(bytes)
            .unwrap();
    }

    #[test]
    fn decodes_all_formats_to_full_scale() {
        let mut out = Vec::new();
        let cf32: Vec<u8> = [0.5f32, -0.25]
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        SampleFormat::Cf32.decode(&cf32, &mut out);
        assert_eq!(out, vec![Complex32::new(0.5, -0.25)]);

        let cs16: Vec<u8> = [16384i16, -32768]
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        SampleFormat::Cs16.decode(&cs16, &mut out);
        assert_eq!(out, vec![Complex32::new(0.5, -1.0)]);

        SampleFormat::Cu8.decode(&[255, 0], &mut out);
        assert_eq!(out, vec![Complex32::new(1.0, -1.0)]);

        SampleFormat::Cs8.decode(&[64, 0x80, 1], &mut out);
        assert_eq!(
            out,
            vec![Complex32::new(0.5, -1.0)],
            "partial samples are ignored"
        );
    }

    #[test]
    fn infers_formats_from_extensions_and_sigmf_types() {
        assert_eq!(
            SampleFormat::from_extension(Path::new("a.CFILE")),
            Some(SampleFormat::Cf32)
        );
        assert_eq!(
            SampleFormat::from_extension(Path::new("a.cu8")),
            Some(SampleFormat::Cu8)
        );
        assert_eq!(SampleFormat::from_extension(Path::new("a.bin")), None);
        assert_eq!(
            SampleFormat::from_sigmf_datatype("ci16_le"),
            Some(SampleFormat::Cs16)
        );
        assert_eq!(SampleFormat::from_sigmf_datatype("cf32_be"), None);
    }

    #[test]
    fn reads_sigmf_recordings() {
        let dir = tempfile::tempdir().unwrap();
        let meta = dir.path().join("cap.sigmf-meta");
        write(
            &meta,
            br#"{"global":{"core:datatype":"ci16_le","core:sample_rate":1e6,"core:version":"1.0.0"},
                "captures":[{"core:sample_start":2,"core:frequency":433.92e6}],"annotations":[]}"#,
        );
        let samples: Vec<u8> = (0..10i16)
            .flat_map(|v| [v, -v])
            .flat_map(i16::to_le_bytes)
            .collect();
        write(&dir.path().join("cap.sigmf-data"), &samples);

        let info = sigmf_recording(&dir.path().join("cap.sigmf-data")).unwrap();
        assert_eq!(info.format, SampleFormat::Cs16);
        assert_eq!(info.sample_rate_hz, 1e6);
        assert_eq!(info.center_hz, 433.92e6);
        assert_eq!(info.total_samples, 8);

        let mut reader = RecordingReader::open(info).unwrap();
        let mut out = Vec::new();
        reader.read_at(1, 3, &mut out).unwrap();
        assert_eq!(out.len(), 3);
        assert_eq!(out[0], Complex32::new(3.0 / 32768.0, -3.0 / 32768.0));
        reader.read_at(6, 10, &mut out).unwrap();
        assert_eq!(out.len(), 2, "reads are clamped to the end of the file");
    }

    #[test]
    fn reports_invalid_sigmf() {
        let dir = tempfile::tempdir().unwrap();
        let meta = dir.path().join("x.sigmf-meta");
        let cases: [(&[u8], &str); 4] = [
            (b"nope", "not valid JSON"),
            (br#"{"global":{"core:sample_rate":1}}"#, "core:datatype"),
            (
                br#"{"global":{"core:datatype":"rf32_le","core:sample_rate":1}}"#,
                "not supported",
            ),
            (br#"{"global":{"core:datatype":"cu8"}}"#, "core:sample_rate"),
        ];
        for (content, message) in cases {
            write(&meta, content);
            let err = sigmf_recording(&meta).unwrap_err().to_string();
            assert!(err.contains(message), "{err}");
        }
        write(
            &meta,
            br#"{"global":{"core:datatype":"cu8","core:sample_rate":1}}"#,
        );
        let err = sigmf_recording(&meta).unwrap_err().to_string();
        assert!(err.contains("data file"), "{err}");
    }

    #[test]
    fn raw_recordings_need_a_sample_rate_and_samples() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.cu8");
        write(&path, &[1, 2, 3, 4, 5]);
        let info = raw_recording(&path, SampleFormat::Cu8, 2.4e6, 100e6).unwrap();
        assert_eq!(info.total_samples, 2);
        assert!(raw_recording(&path, SampleFormat::Cu8, 0.0, 0.0).is_err());
        write(&path, &[1]);
        let err = raw_recording(&path, SampleFormat::Cu8, 1.0, 0.0).unwrap_err();
        assert!(err.to_string().contains("no samples"));
    }
}
