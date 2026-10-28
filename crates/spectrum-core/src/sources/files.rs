//! Recording playback: IQ files (processed like a live SDR) and CSV spectrum traces (displayed as
//! supplied). See `docs/file-formats.md`.

use std::path::{Path, PathBuf};

use rustfft::num_complex::Complex32;

use super::pacer::Pacer;
use super::{IqBlock, OpenedSource, Source, SourceData, SourceDriver, SourceError, TraceBlock};
use crate::formats::FormatError;
use crate::formats::csv::read_spectrum_csv;
use crate::formats::iq::{
    RecordingInfo, RecordingReader, SampleFormat, is_sigmf, raw_recording, sigmf_recording,
};
use crate::model::params::resolve_params;
use crate::model::{
    AmplitudeUnit, Capabilities, DataKind, DriverInfo, DriverStatus, ParamMap, ParamMapExt,
    ParamSpec, SettingsPatch, SourceConfig, SourceKind, SourceSettings, Transport,
};

pub const IQ_FILE_DRIVER_ID: &str = "iq-file";
pub const TRACE_FILE_DRIVER_ID: &str = "trace-csv";
/// Frames per second of wall-clock playback.
const PLAYBACK_BLOCK_RATE_HZ: f64 = 30.0;

const IQ_EXTENSIONS: [&str; 10] = [
    "sigmf-meta",
    "sigmf-data",
    "cf32",
    "cfile",
    "fc32",
    "cs16",
    "sc16",
    "cu8",
    "cs8",
    "sc8",
];

impl From<FormatError> for SourceError {
    fn from(e: FormatError) -> Self {
        match e {
            FormatError::Unsupported(m) => SourceError::unsupported(m),
            other => SourceError::unavailable(other.to_string()).with_cause(other),
        }
    }
}

fn path_param(params: &ParamMap) -> PathBuf {
    PathBuf::from(params.text("path").unwrap_or_default())
}

fn file_label(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}

// ---------------------------------------------------------------------------------------------
// IQ recordings

pub struct IqFileDriver {
    paced: bool,
}

impl IqFileDriver {
    pub fn new() -> Self {
        Self { paced: true }
    }

    /// Replays as fast as blocks are read (tests).
    pub fn unpaced() -> Self {
        Self { paced: false }
    }
}

impl Default for IqFileDriver {
    fn default() -> Self {
        Self::new()
    }
}

fn iq_connection_params() -> Vec<ParamSpec> {
    let mut format_options = vec![("auto", "Auto (SigMF or file extension)")];
    format_options.extend([
        ("cf32", "cf32 — 32-bit float"),
        ("cs16", "cs16 — 16-bit signed"),
        ("cu8", "cu8 — 8-bit unsigned (rtl_sdr)"),
        ("cs8", "cs8 — 8-bit signed (HackRF)"),
    ]);
    vec![
        ParamSpec::path("path", "File", &IQ_EXTENSIONS)
            .with_help("A SigMF recording (.sigmf-meta/.sigmf-data) or a raw interleaved IQ file."),
        ParamSpec::choice("format", "Sample format", &format_options, "auto")
            .with_help("Ignored for SigMF, which describes its own format."),
        ParamSpec::number("sampleRateHz", "Sample rate", 0.0, 1e9, 1.0, 0.0)
            .with_unit("Hz")
            .with_help("Required for raw files; SigMF provides it."),
        ParamSpec::number("centerHz", "Center frequency", 0.0, 1e11, 1.0, 0.0)
            .with_unit("Hz")
            .with_help("Optional for raw files; SigMF provides it."),
    ]
}

fn iq_runtime_params() -> Vec<ParamSpec> {
    vec![
        ParamSpec::boolean("loop", "Loop playback", true),
        ParamSpec::choice(
            "speed",
            "Playback speed",
            &[
                ("0.25", "¼× (slow motion)"),
                ("1", "1× (real time)"),
                ("4", "4×"),
                ("16", "16×"),
            ],
            "1",
        ),
    ]
}

impl SourceDriver for IqFileDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: IQ_FILE_DRIVER_ID.into(),
            name: "IQ recording".into(),
            description: "Replays recorded IQ samples (SigMF, or raw cf32/cs16/cu8/cs8) through \
                          the same FFT and analysis pipeline as a live SDR."
                .into(),
            kind: SourceKind::File,
            transport: Transport::File,
            status: DriverStatus::Available,
            supports_discovery: false,
            connection_params: iq_connection_params(),
        }
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let params = resolve_params(&iq_connection_params(), &config.connection)
            .map_err(SourceError::invalid_settings)?;
        let path = path_param(&params);
        if !path.is_file() {
            return Err(SourceError::unavailable(format!(
                "The file {} does not exist.",
                path.display()
            )));
        }
        let info = if is_sigmf(&path) {
            sigmf_recording(&path)?
        } else {
            let format = match params.text("format").unwrap_or("auto") {
                "auto" => SampleFormat::from_extension(&path).ok_or_else(|| {
                    SourceError::invalid_settings(
                        "The sample format cannot be inferred from the file extension; choose it \
                         explicitly.",
                    )
                })?,
                id => SampleFormat::from_id(id).ok_or_else(|| {
                    SourceError::invalid_settings(format!("Unknown sample format \"{id}\"."))
                })?,
            };
            raw_recording(
                &path,
                format,
                params.number("sampleRateHz").unwrap_or(0.0),
                params.number("centerHz").unwrap_or(0.0),
            )?
        };
        Ok(OpenedSource {
            label: file_label(&path),
            source: Box::new(IqFileSource::new(RecordingReader::open(info)?, self.paced)),
            simulated: false,
        })
    }
}

pub struct IqFileSource {
    reader: RecordingReader,
    caps: Capabilities,
    settings: SourceSettings,
    pacer: Pacer,
    block: u64,
    /// Sample index of the next block.
    position: u64,
    running: bool,
    discontinuity: bool,
    buffer: Vec<Complex32>,
}

impl IqFileSource {
    fn new(reader: RecordingReader, paced: bool) -> Self {
        let info: RecordingInfo = reader.info().clone();
        let params = resolve_params(&iq_runtime_params(), &ParamMap::new()).unwrap_or_default();
        let looping = params.flag("loop").unwrap_or(true);
        Self {
            caps: Capabilities {
                data_kind: DataKind::Iq,
                tuning: None,
                span_options_hz: Vec::new(),
                amplitude_unit: AmplitudeUnit::Dbfs,
                finite: !looping,
                params: iq_runtime_params(),
            },
            settings: SourceSettings {
                center_hz: info.center_hz,
                span_hz: info.sample_rate_hz,
                params,
            },
            reader,
            pacer: Pacer::new(PLAYBACK_BLOCK_RATE_HZ, paced),
            block: 0,
            position: 0,
            running: false,
            discontinuity: true,
            buffer: Vec::new(),
        }
    }

    fn looping(&self) -> bool {
        self.settings.params.flag("loop").unwrap_or(true)
    }

    /// Samples to advance per block so playback runs at the selected speed.
    fn hop(&self) -> u64 {
        let speed: f64 = self
            .settings
            .params
            .text("speed")
            .and_then(|s| s.parse().ok())
            .unwrap_or(1.0);
        ((self.settings.span_hz * speed / PLAYBACK_BLOCK_RATE_HZ).round() as u64).max(1)
    }
}

impl Source for IqFileSource {
    fn capabilities(&self) -> &Capabilities {
        &self.caps
    }

    fn settings(&self) -> &SourceSettings {
        &self.settings
    }

    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError> {
        let mut params = self.settings.params.clone();
        params.extend(patch.params.clone());
        self.settings.params =
            resolve_params(&self.caps.params, &params).map_err(SourceError::invalid_settings)?;
        self.caps.finite = !self.looping();
        Ok(())
    }

    fn start(&mut self) -> Result<(), SourceError> {
        if self.position >= self.reader.info().total_samples {
            self.position = 0;
        }
        self.running = true;
        self.discontinuity = true;
        self.pacer.reset();
        Ok(())
    }

    fn read(&mut self, samples_wanted: usize) -> Result<SourceData, SourceError> {
        if !self.running {
            return Err(SourceError::io("Playback is not running."));
        }
        let total = self.reader.info().total_samples;
        if (samples_wanted as u64) > total {
            return Err(SourceError::invalid_settings(format!(
                "The recording has only {total} samples; choose an FFT size of at most {total}."
            )));
        }
        if self.position + samples_wanted as u64 > total {
            if !self.looping() {
                self.running = false;
                self.position = total; // the next start() rewinds
                return Ok(SourceData::EndOfStream);
            }
            self.position = 0;
            self.discontinuity = true;
        }
        self.pacer.wait(self.block);
        self.reader
            .read_at(self.position, samples_wanted, &mut self.buffer)
            .map_err(|e| {
                SourceError::disconnected(format!("Reading the recording failed: {e}"))
                    .with_cause(e)
            })?;
        self.block += 1;
        self.position += self.hop();
        Ok(SourceData::Iq(IqBlock {
            samples: std::mem::take(&mut self.buffer),
            sample_rate_hz: self.settings.span_hz,
            center_hz: self.settings.center_hz,
            discontinuity: std::mem::take(&mut self.discontinuity),
        }))
    }

    fn stop(&mut self) -> Result<(), SourceError> {
        self.running = false;
        Ok(())
    }
}

// ---------------------------------------------------------------------------------------------
// CSV spectrum traces

pub struct TraceFileDriver;

fn trace_connection_params() -> Vec<ParamSpec> {
    vec![
        ParamSpec::path("path", "File", &["csv", "txt"]).with_help(
            "Spectrum Studio CSV export, or any CSV with frequency (Hz) and level columns.",
        ),
        ParamSpec::choice(
            "unit",
            "Level unit",
            &[
                ("auto", "From file (dB if unknown)"),
                ("dbm", "dBm (calibrated)"),
                ("dbfs", "dBFS"),
                ("db", "dB (relative)"),
            ],
            "auto",
        )
        .with_help("Only choose dBm if the data really is calibrated absolute power."),
    ]
}

impl SourceDriver for TraceFileDriver {
    fn info(&self) -> DriverInfo {
        DriverInfo {
            id: TRACE_FILE_DRIVER_ID.into(),
            name: "Spectrum trace (CSV)".into(),
            description: "Displays a recorded spectrum trace as supplied — no FFT is applied. \
                          Accepts Spectrum Studio exports and generic frequency/level CSV."
                .into(),
            kind: SourceKind::File,
            transport: Transport::File,
            status: DriverStatus::Available,
            supports_discovery: false,
            connection_params: trace_connection_params(),
        }
    }

    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError> {
        let params = resolve_params(&trace_connection_params(), &config.connection)
            .map_err(SourceError::invalid_settings)?;
        let path = path_param(&params);
        let file = std::fs::File::open(&path).map_err(|e| {
            SourceError::unavailable(format!("Could not open {}: {e}", path.display()))
                .with_cause(e)
        })?;
        let trace = read_spectrum_csv(std::io::BufReader::new(file))?;
        let unit = match params.text("unit").unwrap_or("auto") {
            "dbm" => AmplitudeUnit::Dbm,
            "dbfs" => AmplitudeUnit::Dbfs,
            "db" => AmplitudeUnit::Db,
            _ => trace.unit.unwrap_or(AmplitudeUnit::Db),
        };
        let span = trace.bin_hz * (trace.values.len() - 1) as f64;
        let block = TraceBlock {
            values: trace.values,
            start_hz: trace.start_hz,
            bin_hz: trace.bin_hz,
            unit,
            rbw_hz: trace.rbw_hz,
        };
        Ok(OpenedSource {
            label: file_label(&path),
            source: Box::new(TraceFileSource {
                caps: Capabilities {
                    data_kind: DataKind::Trace,
                    tuning: None,
                    span_options_hz: Vec::new(),
                    amplitude_unit: unit,
                    finite: true,
                    params: Vec::new(),
                },
                settings: SourceSettings {
                    center_hz: block.start_hz + span / 2.0,
                    span_hz: span,
                    params: ParamMap::new(),
                },
                block,
                delivered: false,
            }),
            simulated: false,
        })
    }
}

pub struct TraceFileSource {
    caps: Capabilities,
    settings: SourceSettings,
    block: TraceBlock,
    delivered: bool,
}

impl Source for TraceFileSource {
    fn capabilities(&self) -> &Capabilities {
        &self.caps
    }

    fn settings(&self) -> &SourceSettings {
        &self.settings
    }

    fn apply(&mut self, _patch: &SettingsPatch) -> Result<(), SourceError> {
        Ok(())
    }

    fn start(&mut self) -> Result<(), SourceError> {
        self.delivered = false;
        Ok(())
    }

    /// Delivers the trace once, then reports the end of the recording.
    fn read(&mut self, _samples_wanted: usize) -> Result<SourceData, SourceError> {
        if std::mem::replace(&mut self.delivered, true) {
            Ok(SourceData::EndOfStream)
        } else {
            Ok(SourceData::Trace(self.block.clone()))
        }
    }

    fn stop(&mut self) -> Result<(), SourceError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ParamValue;
    use crate::sources::SourceErrorKind;
    use std::io::Write;

    fn config(driver: &str, params: &[(&str, ParamValue)]) -> SourceConfig {
        let mut c = SourceConfig::new(driver);
        for (k, v) in params {
            c.connection.insert((*k).into(), v.clone());
        }
        c
    }

    fn text(s: &str) -> ParamValue {
        ParamValue::Text(s.into())
    }

    fn write_cu8_tone(path: &Path, samples: usize, cycles_per_sample: f64) {
        let mut f = std::fs::File::create(path).unwrap();
        for n in 0..samples {
            let ph = 2.0 * std::f64::consts::PI * cycles_per_sample * n as f64;
            let i = (127.5 + 100.0 * ph.cos()).round() as u8;
            let q = (127.5 + 100.0 * ph.sin()).round() as u8;
            f.write_all(&[i, q]).unwrap();
        }
    }

    fn read_iq(src: &mut dyn Source, n: usize) -> IqBlock {
        match src.read(n).unwrap() {
            SourceData::Iq(b) => b,
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn raw_iq_file_plays_and_loops() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tone.cu8");
        write_cu8_tone(&path, 30_000, 0.125);
        let opened = IqFileDriver::unpaced()
            .open(&config(
                IQ_FILE_DRIVER_ID,
                &[
                    ("path", text(path.to_str().unwrap())),
                    ("sampleRateHz", ParamValue::Number(240_000.0)),
                    ("centerHz", ParamValue::Number(100e6)),
                ],
            ))
            .unwrap();
        assert_eq!(opened.label, "tone.cu8");
        let mut src = opened.source;
        assert!(src.capabilities().tuning.is_none());
        assert_eq!(src.settings().span_hz, 240_000.0);
        src.start().unwrap();
        let first = read_iq(src.as_mut(), 1024);
        assert!(first.discontinuity);
        assert_eq!(first.center_hz, 100e6);
        assert_eq!(first.samples.len(), 1024);
        // hop = 240000 / 30 = 8000 samples per block; 30000 samples → wraps on block 4.
        let wrapped = (0..4).map(|_| read_iq(src.as_mut(), 1024)).last().unwrap();
        assert!(wrapped.discontinuity);
    }

    #[test]
    fn non_looping_playback_ends() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.cf32");
        std::fs::write(&path, vec![0u8; 8 * 4000]).unwrap();
        let mut src = IqFileDriver::unpaced()
            .open(&config(
                IQ_FILE_DRIVER_ID,
                &[
                    ("path", text(path.to_str().unwrap())),
                    ("sampleRateHz", ParamValue::Number(30_000.0)),
                ],
            ))
            .unwrap()
            .source;
        src.apply(&SettingsPatch {
            params: [("loop".to_string(), ParamValue::Bool(false))].into(),
            ..Default::default()
        })
        .unwrap();
        assert!(src.capabilities().finite);
        src.start().unwrap();
        let mut blocks = 0;
        while let SourceData::Iq(_) = src.read(1024).unwrap() {
            blocks += 1;
        }
        assert_eq!(blocks, 3); // positions 0, 1000, 2000 fit; 3000 + 1024 > 4000
        assert!(matches!(src.read(1024), Err(e) if e.kind() == SourceErrorKind::Io));
        let err = {
            src.start().unwrap();
            src.read(8192).unwrap_err()
        };
        assert!(err.to_string().contains("only 4000 samples"));
    }

    #[test]
    fn iq_file_errors_are_explained() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("missing.cf32");
        let err = IqFileDriver::unpaced()
            .open(&config(
                IQ_FILE_DRIVER_ID,
                &[("path", text(missing.to_str().unwrap()))],
            ))
            .err()
            .unwrap();
        assert!(err.to_string().contains("does not exist"));

        let unknown = dir.path().join("rec.bin");
        std::fs::write(&unknown, [0u8; 64]).unwrap();
        let err = IqFileDriver::unpaced()
            .open(&config(
                IQ_FILE_DRIVER_ID,
                &[("path", text(unknown.to_str().unwrap()))],
            ))
            .err()
            .unwrap();
        assert!(err.to_string().contains("choose it explicitly"), "{err}");

        let err = IqFileDriver::unpaced()
            .open(&config(
                IQ_FILE_DRIVER_ID,
                &[
                    ("path", text(unknown.to_str().unwrap())),
                    ("format", text("cf32")),
                ],
            ))
            .err()
            .unwrap();
        assert!(err.to_string().contains("sample rate"), "{err}");

        let err = IqFileDriver::unpaced()
            .open(&SourceConfig::new(IQ_FILE_DRIVER_ID))
            .err()
            .unwrap();
        assert!(err.to_string().contains("File is required"), "{err}");
    }

    #[test]
    fn csv_trace_is_delivered_once_with_its_unit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("trace.csv");
        std::fs::write(
            &path,
            "freq,level (dBm)\n1e9,-80\n1.001e9,-30\n1.002e9,-81\n",
        )
        .unwrap();
        let opened = TraceFileDriver
            .open(&config(
                TRACE_FILE_DRIVER_ID,
                &[("path", text(path.to_str().unwrap()))],
            ))
            .unwrap();
        let mut src = opened.source;
        assert_eq!(src.capabilities().amplitude_unit, AmplitudeUnit::Dbm);
        assert_eq!(src.capabilities().data_kind, DataKind::Trace);
        assert_eq!(src.settings().center_hz, 1.001e9);
        src.start().unwrap();
        match src.read(0).unwrap() {
            SourceData::Trace(t) => assert_eq!(t.values, vec![-80.0, -30.0, -81.0]),
            other => panic!("{other:?}"),
        }
        assert_eq!(src.read(0).unwrap(), SourceData::EndOfStream);

        // The user can override the unit, e.g. when a file has no unit information.
        let opened = TraceFileDriver
            .open(&config(
                TRACE_FILE_DRIVER_ID,
                &[("path", text(path.to_str().unwrap())), ("unit", text("db"))],
            ))
            .unwrap();
        assert_eq!(
            opened.source.capabilities().amplitude_unit,
            AmplitudeUnit::Db
        );
    }

    #[test]
    fn invalid_csv_is_rejected_on_connect() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.csv");
        std::fs::write(&path, "1,0\n2,0\n10,0\n").unwrap();
        let err = TraceFileDriver
            .open(&config(
                TRACE_FILE_DRIVER_ID,
                &[("path", text(path.to_str().unwrap()))],
            ))
            .err()
            .unwrap();
        assert!(err.kind() == SourceErrorKind::Unsupported);
        assert!(err.to_string().contains("evenly spaced"));
    }
}
