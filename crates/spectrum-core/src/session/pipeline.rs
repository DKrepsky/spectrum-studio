//! Turns source data into spectrum frames: IQ → spectrum (estimator), then averaging, holds and
//! peak search for both IQ- and trace-based sources.

use rustfft::num_complex::Complex32;

use crate::dsp::{SpectrumEstimator, TraceProcessor, find_peaks, noise_floor};
use crate::model::frame::FRAME_FORMAT_VERSION;
use crate::model::session::now_ms;
use crate::model::{
    AmplitudeUnit, DataKind, FrameHeader, ProcessingSettings, SpectrumFrame, WindowKind,
};
use crate::sources::{IqBlock, TraceBlock};

/// Identity of a frame's frequency/amplitude axes; when it changes, averages and holds restart.
#[derive(Debug, Clone, PartialEq)]
struct AxisKey {
    start_hz: f64,
    bin_hz: f64,
    bins: usize,
    unit: AmplitudeUnit,
    window: Option<WindowKind>,
}

pub struct FrameContext<'a> {
    pub source_label: &'a str,
    pub simulated: bool,
}

pub struct Pipeline {
    settings: ProcessingSettings,
    estimator: Option<SpectrumEstimator>,
    processor: TraceProcessor,
    pending: Vec<Complex32>,
    pending_meta: Option<(f64, f64)>,
    axis: Option<AxisKey>,
    spectrum: Vec<f32>,
}

impl Pipeline {
    pub fn new(settings: ProcessingSettings) -> Self {
        let processor =
            TraceProcessor::new(settings.averaging, settings.max_hold, settings.min_hold);
        Self {
            settings,
            estimator: None,
            processor,
            pending: Vec::new(),
            pending_meta: None,
            axis: None,
            spectrum: Vec::new(),
        }
    }

    pub fn settings(&self) -> &ProcessingSettings {
        &self.settings
    }

    pub fn configure(&mut self, settings: ProcessingSettings) {
        self.processor
            .configure(settings.averaging, settings.max_hold, settings.min_hold);
        self.settings = settings;
    }

    /// Clears buffered samples, averages and holds.
    pub fn reset(&mut self) {
        self.pending.clear();
        self.pending_meta = None;
        self.processor.reset();
    }

    pub fn reset_holds(&mut self) {
        self.processor.reset_holds();
    }

    /// IQ samples needed for one spectrum.
    pub fn samples_wanted(&self) -> usize {
        self.settings.fft_size as usize
    }

    pub fn push_iq(&mut self, block: IqBlock, ctx: &FrameContext) -> Option<SpectrumFrame> {
        let n = self.samples_wanted();
        let meta = (block.center_hz, block.sample_rate_hz);
        if block.discontinuity || self.pending_meta != Some(meta) {
            self.pending.clear();
        }
        self.pending_meta = Some(meta);
        if block.samples.len() >= n {
            self.pending.clear();
            self.pending
                .extend_from_slice(&block.samples[block.samples.len() - n..]);
        } else {
            self.pending.extend_from_slice(&block.samples);
            if self.pending.len() < n {
                return None;
            }
            let excess = self.pending.len() - n;
            self.pending.drain(..excess);
        }

        let window = self.settings.window;
        let estimator = match &mut self.estimator {
            Some(e) if e.fft_size() == n && e.window().kind == window => e,
            slot => slot.insert(SpectrumEstimator::new(n, window)),
        };
        estimator.compute(&self.pending, &mut self.spectrum);
        let enbw = estimator.window().enbw_bins;
        self.pending.clear();

        let fs = block.sample_rate_hz;
        let bin_hz = fs / n as f64;
        let spectrum = std::mem::take(&mut self.spectrum);
        let frame = self.finish(
            &spectrum,
            AxisInfo {
                center_hz: block.center_hz,
                span_hz: fs,
                start_hz: block.center_hz - fs / 2.0,
                bin_hz,
                unit: AmplitudeUnit::Dbfs,
                rbw_hz: Some(enbw * bin_hz),
                data_kind: DataKind::Iq,
                fft_size: Some(n as u32),
                window: Some(window),
            },
            ctx,
        );
        self.spectrum = spectrum;
        Some(frame)
    }

    pub fn push_trace(&mut self, block: TraceBlock, ctx: &FrameContext) -> Option<SpectrumFrame> {
        if block.values.is_empty() {
            return None;
        }
        let span = block.bin_hz * (block.values.len() - 1) as f64;
        Some(self.finish(
            &block.values,
            AxisInfo {
                center_hz: block.start_hz + span / 2.0,
                span_hz: span,
                start_hz: block.start_hz,
                bin_hz: block.bin_hz,
                unit: block.unit,
                rbw_hz: block.rbw_hz,
                data_kind: DataKind::Trace,
                fft_size: None,
                window: None,
            },
            ctx,
        ))
    }

    fn finish(&mut self, trace: &[f32], axis: AxisInfo, ctx: &FrameContext) -> SpectrumFrame {
        // Window shape is needed for exact peak amplitudes of FFT spectra.
        let window = match axis.data_kind {
            DataKind::Iq => self.estimator.as_ref().map(|e| e.window()),
            DataKind::Trace => None,
        };
        let key = AxisKey {
            start_hz: axis.start_hz,
            bin_hz: axis.bin_hz,
            bins: trace.len(),
            unit: axis.unit,
            window: axis.window,
        };
        if self.axis.as_ref() != Some(&key) {
            self.processor.reset();
            self.axis = Some(key);
        }
        let processed = self.processor.process(trace);
        let floor = noise_floor(&processed.live);
        let peaks = match floor {
            Some(floor) => find_peaks(
                &processed.live,
                axis.start_hz,
                axis.bin_hz,
                floor,
                &self.settings.peaks,
                window,
            ),
            None => Vec::new(),
        };
        SpectrumFrame {
            header: FrameHeader {
                version: FRAME_FORMAT_VERSION,
                seq: 0,
                timestamp_ms: now_ms(),
                source_label: ctx.source_label.to_string(),
                simulated: ctx.simulated,
                data_kind: axis.data_kind,
                unit: axis.unit,
                center_hz: axis.center_hz,
                span_hz: axis.span_hz,
                start_hz: axis.start_hz,
                bin_hz: axis.bin_hz,
                bins: trace.len() as u32,
                rbw_hz: axis.rbw_hz,
                fft_size: axis.fft_size,
                window: axis.window,
                averaging: self.settings.averaging,
                averaged_count: processed.averaged_count,
                traces: Vec::new(),
                noise_floor: floor.map(f64::from),
                peaks,
            },
            live: processed.live,
            max_hold: processed.max_hold,
            min_hold: processed.min_hold,
        }
    }
}

struct AxisInfo {
    center_hz: f64,
    span_hz: f64,
    start_hz: f64,
    bin_hz: f64,
    unit: AmplitudeUnit,
    rbw_hz: Option<f64>,
    data_kind: DataKind,
    fft_size: Option<u32>,
    window: Option<WindowKind>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const CTX: FrameContext = FrameContext {
        source_label: "test",
        simulated: true,
    };

    fn block(len: usize, discontinuity: bool) -> IqBlock {
        IqBlock {
            samples: vec![Complex32::new(0.5, 0.0); len],
            sample_rate_hz: 1e6,
            center_hz: 10e6,
            discontinuity,
        }
    }

    fn settings(fft_size: u32) -> ProcessingSettings {
        ProcessingSettings {
            fft_size,
            ..Default::default()
        }
    }

    #[test]
    fn iq_frame_axis_and_metadata() {
        let mut p = Pipeline::new(settings(256));
        let frame = p.push_iq(block(1000, true), &CTX).unwrap();
        let h = &frame.header;
        assert_eq!(h.bins, 256);
        assert_eq!(frame.live.len(), 256);
        assert_eq!(h.start_hz, 9.5e6);
        assert!((h.bin_hz - 1e6 / 256.0).abs() < 1e-9);
        assert_eq!(h.unit, AmplitudeUnit::Dbfs);
        assert_eq!(h.window, Some(WindowKind::Hann));
        assert!((h.rbw_hz.unwrap() - 1.5 * 1e6 / 256.0).abs() < 1e-6);
        // DC tone of amplitude 0.5 → -6.02 dBFS at the centre bin.
        assert!((frame.live[128] + 6.0206).abs() < 0.01);
        assert!((frame.frequency_of(128) - 10e6).abs() < 1e-6);
    }

    #[test]
    fn short_blocks_accumulate_until_fft_is_full() {
        let mut p = Pipeline::new(settings(256));
        assert!(p.push_iq(block(100, true), &CTX).is_none());
        assert!(p.push_iq(block(100, false), &CTX).is_none());
        assert!(p.push_iq(block(100, false), &CTX).is_some());
        // A discontinuity discards buffered samples.
        assert!(p.push_iq(block(200, false), &CTX).is_none());
        assert!(p.push_iq(block(100, true), &CTX).is_none());
    }

    #[test]
    fn axis_change_restarts_average() {
        let mut p = Pipeline::new(ProcessingSettings {
            fft_size: 256,
            averaging: 10,
            ..Default::default()
        });
        p.push_iq(block(256, true), &CTX);
        let f = p.push_iq(block(256, false), &CTX).unwrap();
        assert_eq!(f.header.averaged_count, 2);
        let mut retuned = block(256, true);
        retuned.center_hz = 11e6;
        let f = p.push_iq(retuned, &CTX).unwrap();
        assert_eq!(f.header.averaged_count, 1);
    }

    #[test]
    fn fft_size_change_takes_effect_on_next_frame() {
        let mut p = Pipeline::new(settings(256));
        p.push_iq(block(4096, true), &CTX);
        p.configure(settings(1024));
        let f = p.push_iq(block(4096, false), &CTX).unwrap();
        assert_eq!(f.header.bins, 1024);
        assert_eq!(f.header.fft_size, Some(1024));
    }

    #[test]
    fn traces_are_used_as_supplied() {
        let mut p = Pipeline::new(settings(256));
        let f = p
            .push_trace(
                TraceBlock {
                    values: vec![-90.0, -30.0, -90.0, -91.0, -92.0],
                    start_hz: 1e9,
                    bin_hz: 1e6,
                    unit: AmplitudeUnit::Dbm,
                    rbw_hz: Some(100e3),
                },
                &CTX,
            )
            .unwrap();
        assert_eq!(f.live, vec![-90.0, -30.0, -90.0, -91.0, -92.0]);
        assert_eq!(f.header.unit, AmplitudeUnit::Dbm);
        assert_eq!(f.header.data_kind, DataKind::Trace);
        assert_eq!(f.header.center_hz, 1.002e9);
        assert_eq!(f.header.span_hz, 4e6);
        assert_eq!(f.header.fft_size, None);
        assert_eq!(f.header.peaks.len(), 1);
    }
}
