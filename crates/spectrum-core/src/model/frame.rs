//! Processed spectrum frames and their binary wire format (see ADR 0003).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::processing::WindowKind;
use super::source::DataKind;
use super::units::AmplitudeUnit;

/// Version of the binary frame layout; bump when the layout changes.
pub const FRAME_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Peak {
    /// Interpolated peak frequency.
    pub frequency_hz: f64,
    /// Interpolated peak amplitude in the frame's unit.
    pub amplitude: f64,
    /// Index of the highest bin of the peak.
    pub bin: u32,
    pub prominence_db: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TraceKind {
    /// The current (possibly averaged) trace.
    Live,
    MaxHold,
    MinHold,
}

/// Metadata describing exactly how a frame was produced.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FrameHeader {
    pub version: u32,
    /// Monotonic for the lifetime of the application; the UI uses it to detect new frames.
    pub seq: u32,
    /// Wall-clock time the frame was produced (Unix epoch, milliseconds).
    pub timestamp_ms: f64,
    pub source_label: String,
    pub simulated: bool,
    pub data_kind: DataKind,
    pub unit: AmplitudeUnit,
    pub center_hz: f64,
    pub span_hz: f64,
    /// Frequency of bin 0; bin `i` is at `start_hz + i * bin_hz`.
    pub start_hz: f64,
    pub bin_hz: f64,
    pub bins: u32,
    /// Resolution bandwidth (equivalent noise bandwidth of one bin), when known.
    pub rbw_hz: Option<f64>,
    pub fft_size: Option<u32>,
    pub window: Option<WindowKind>,
    /// Configured averaging length and how many traces are currently in the average.
    pub averaging: u32,
    pub averaged_count: u32,
    /// Traces present in the payload, in order.
    pub traces: Vec<TraceKind>,
    /// Estimated noise floor of the live trace (median level per bin), in the frame's unit.
    pub noise_floor: Option<f64>,
    pub peaks: Vec<Peak>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SpectrumFrame {
    pub header: FrameHeader,
    pub live: Vec<f32>,
    pub max_hold: Option<Vec<f32>>,
    pub min_hold: Option<Vec<f32>>,
}

impl SpectrumFrame {
    pub fn frequency_of(&self, bin: usize) -> f64 {
        self.header.start_hz + bin as f64 * self.header.bin_hz
    }

    /// Traces in payload order, matching `header.traces`.
    pub fn traces(&self) -> Vec<(TraceKind, &[f32])> {
        let mut traces = vec![(TraceKind::Live, self.live.as_slice())];
        if let Some(t) = &self.max_hold {
            traces.push((TraceKind::MaxHold, t.as_slice()));
        }
        if let Some(t) = &self.min_hold {
            traces.push((TraceKind::MinHold, t.as_slice()));
        }
        traces
    }

    /// Encodes the frame as: `u32 LE header length`, JSON header, zero padding to a multiple of
    /// four bytes, then each trace as little-endian `f32` values.
    pub fn encode(&self) -> Vec<u8> {
        let traces = self.traces();
        let mut header = self.header.clone();
        header.traces = traces.iter().map(|(k, _)| *k).collect();
        header.bins = self.live.len() as u32;
        // Serialising a plain struct of numbers, strings and enums cannot fail.
        let json = serde_json::to_vec(&header).unwrap_or_default();
        let padding = (4 - (4 + json.len()) % 4) % 4;
        let data_len: usize = traces.iter().map(|(_, t)| t.len() * 4).sum();
        let mut out = Vec::with_capacity(4 + json.len() + padding + data_len);
        out.extend_from_slice(&(json.len() as u32).to_le_bytes());
        out.extend_from_slice(&json);
        out.resize(out.len() + padding, 0);
        for (_, trace) in traces {
            for v in trace {
                out.extend_from_slice(&v.to_le_bytes());
            }
        }
        out
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub fn sample_frame() -> SpectrumFrame {
        SpectrumFrame {
            header: FrameHeader {
                version: FRAME_FORMAT_VERSION,
                seq: 7,
                timestamp_ms: 1_700_000_000_000.0,
                source_label: "Simulator".into(),
                simulated: true,
                data_kind: DataKind::Iq,
                unit: AmplitudeUnit::Dbfs,
                center_hz: 100e6,
                span_hz: 2e6,
                start_hz: 99e6,
                bin_hz: 500_000.0,
                bins: 4,
                rbw_hz: Some(750_000.0),
                fft_size: Some(4),
                window: Some(WindowKind::Hann),
                averaging: 1,
                averaged_count: 1,
                traces: vec![],
                noise_floor: Some(-80.0),
                peaks: vec![Peak {
                    frequency_hz: 100e6,
                    amplitude: -20.0,
                    bin: 2,
                    prominence_db: 60.0,
                }],
            },
            live: vec![-80.0, -79.5, -20.0, -81.25],
            max_hold: Some(vec![-70.0, -70.0, -19.0, -70.0]),
            min_hold: None,
        }
    }

    #[test]
    fn encoding_layout_is_aligned_and_complete() {
        let frame = sample_frame();
        let bytes = frame.encode();
        let header_len = u32::from_le_bytes(bytes[0..4].try_into().unwrap()) as usize;
        let data_start = (4 + header_len).div_ceil(4) * 4;
        assert_eq!(bytes.len(), data_start + 2 * 4 * 4);

        let header: FrameHeader = serde_json::from_slice(&bytes[4..4 + header_len]).unwrap();
        assert_eq!(header.traces, vec![TraceKind::Live, TraceKind::MaxHold]);
        assert_eq!(header.bins, 4);

        let first = f32::from_le_bytes(bytes[data_start..data_start + 4].try_into().unwrap());
        assert_eq!(first, -80.0);
        let max2 = data_start + 16 + 8;
        assert_eq!(
            f32::from_le_bytes(bytes[max2..max2 + 4].try_into().unwrap()),
            -19.0
        );
    }

    /// Writes the cross-language fixture decoded by `src/ipc/frame.test.ts`.
    #[test]
    fn write_frontend_fixture() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../src/ipc/__fixtures__/frame-v1.bin");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let bytes = sample_frame().encode();
        if std::fs::read(&path).ok().as_deref() != Some(bytes.as_slice()) {
            std::fs::write(&path, bytes).unwrap();
        }
    }
}
