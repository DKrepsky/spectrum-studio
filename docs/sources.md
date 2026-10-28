# Sources

Code: `crates/spectrum-core/src/sources/`. Decision record: [ADR 0004](adr/0004-source-abstraction.md).

## Model

```rust
trait SourceDriver: Send + Sync {          // one per integration type
    fn info(&self) -> DriverInfo;           // name, kind, transport, status, connection params
    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError>;   // optional
    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError>;
}

trait Source: Send {                         // an open connection, used by one worker thread
    fn capabilities(&self) -> &Capabilities; // data kind, tuning range, spans, unit, params
    fn settings(&self) -> &SourceSettings;   // centre, span, param values in effect
    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError>;
    fn start(&mut self) -> Result<(), SourceError>;
    fn read(&mut self, samples_wanted: usize) -> Result<SourceData, SourceError>; // ≤ ~250 ms
    fn stop(&mut self) -> Result<(), SourceError>;
}

enum SourceData { Iq(IqBlock), Trace(TraceBlock), EndOfStream }
```

- **DriverInfo.kind:** `Sdr`, `SpectrumAnalyzer`, `File`, `Simulator` — how the UI groups sources.
- **DriverInfo.transport:** `Usb`, `Serial`, `Network`, `File`, `Internal` — shown as a badge.
- **DriverInfo.status:** `Available` or `Planned` (listed honestly, cannot be opened).
- **Capabilities** declare only what the source really supports. `tuning: None` hides tuning;
  an empty `span_options_hz` means a fixed span; `amplitude_unit` is the truth about calibration.
- **ParamSpec** describes device-specific settings (number with range/unit, choice, bool, text,
  path). The UI renders forms from them; the core validates submitted values against them
  (`model/params.rs`), so drivers receive only valid, complete parameter maps.

### Errors

| `SourceError` | Meaning | Session reaction |
| --- | --- | --- |
| `Unavailable` | Cannot open (missing, busy, permission) | Connect fails, notice shown |
| `InvalidSettings` | Settings rejected | Command fails, previous settings kept |
| `Io` | Recoverable read problem | Acquisition stops, *Restart* offered |
| `Disconnected` | Device gone | Source closed, *Reconnect* offered |
| `Unsupported` | Not implemented | Shown as is |

Messages are shown to the user verbatim — write complete, actionable sentences.

## Session lifecycle

`SessionManager` (`session/mod.rs`) owns at most one source on a dedicated worker thread:

```
Disconnected ──connect──► Connecting ──ok──► Connected ──start──► Acquiring
      ▲                        │ error                 ◄──stop───      │
      │                        ▼                                       │ device lost
      └──────────── Disconnected (+ notice) ◄─────────────────────────┘
```

Connecting always stops and joins the previous worker first. Settings and processing changes are
queued to the worker and applied between reads.

## Built-in integrations

| Id | Name | Kind / transport | Status |
| --- | --- | --- | --- |
| `simulator` | Signal simulator | Simulator / Internal | Available |
| `iq-file` | IQ recording (SigMF, cf32, cs16, cu8, cs8) | File / File | Available |
| `trace-csv` | Spectrum trace (CSV) | File / File | Available |
| `sa430` | TI SA430 spectrum analyzer | Analyzer / Serial | Available |
| `soapysdr` | SoapySDR devices (RTL-SDR, HackRF, Airspy, …) | SDR / USB | Planned |
| `rtl_tcp` | rtl_tcp server | SDR / Network | Planned |
| `scpi_lan` | SCPI spectrum analyzer (LAN) | Analyzer / Network | Planned |
| `tinysa` | tinySA | Analyzer / Serial | Planned |

### TI SA430

Code: `crates/spectrum-driver-sa430`, on top of the [`sa430`](https://crates.io/crates/sa430) crate (same
author). Tested on an MSP-SA430-SUB1GHZ (hardware 2.0, core 2.10, spectrum firmware 2.5).

- **Data:** `Trace`, factory-calibrated **dBm** (calibration is read from the device flash on
  connect). RBW is selected by the device from the step and is not reported yet (`rbw_hz: None`).
- **Discovery:** USB scan by vendor/product id (udev on Linux); connecting without a chosen device
  or port uses the first one found. Needs `libudev` at build/run time and membership of the
  `dialout` group.
- **Bands:** the instrument measures 300–348, 389–464 and 779–928 MHz; a sweep cannot cross
  bands. Centre and span select the window; if it sticks out of the band it is **shifted** back
  inside (the reported centre is the one actually swept). A centre between bands or a span wider
  than its band is rejected.
- **Settings:** spans 1–149 MHz; *Frequency step* 10–500 kHz; *Reference level* −35…−70 dBm.
- **Sweep time** is ≈1.3 ms per point and a sweep cannot be interrupted, so requests above 800
  points (~1 s) are rejected with a hint to raise the step. Stop/Disconnect therefore take effect
  after the current sweep, which can exceed the usual 250 ms `read` budget for large sweeps.
- **Errors:** open failures explain `dialout`/unplugged causes; a read timeout is recoverable
  (*Restart*); a broken pipe or serial error disconnects the session.
- **Tests:** `crates/spectrum-driver-sa430/tests/session.rs` runs the session against the library's mock channel (including
  silent device and unplugging). `cargo test -p spectrum-driver-sa430 -- --ignored --nocapture`
  runs a sweep session on a real device.

### Simulator

A virtual tunable receiver (0–6 GHz, 250 kS/s – 10 MS/s) observing a fixed scene of emitters at
absolute frequencies; an ideal anti-alias filter removes anything outside ±fs/2, and the ADC
saturates at full scale. Simulated time advances by 1/30 s per block and samples come from a
documented PRNG ([ADR 0005](adr/0005-deterministic-simulator.md)), so output depends only on the
seed and settings. Fault injection: *Fail to connect* (connection option) and *Simulate device
loss after N s* (runtime setting). Parameters are listed in the [user guide](user-guide.md#simulator).

### IQ recordings

Replayed through the same pipeline as a live SDR, paced to real time (30 blocks/s); each block
reads `N` samples at the playback position and advances by `fs·speed/30` samples. Looping is
optional; without it the source reports end of stream.

### CSV traces

Read once on connect (invalid files are rejected with the line number and reason) and delivered as
one `Trace` block, then end of stream.

## Adding an integration

1. Implement `SourceDriver` and `Source` in `sources/<name>.rs`. Keep protocol code testable
   without hardware (parse functions over byte slices, mock transports).
2. Register it in `driver_registry()` in `src-tauri/src/lib.rs` (or update the planned entry). Hardware drivers get their own `crates/spectrum-driver-<name>` crate that depends on `spectrum-core`; only drivers with no extra dependencies belong in `spectrum-core` itself.
3. Test: protocol/format unit tests plus a session test in `tests/` that connects, acquires and
   disconnects, including one failure path. `tests/session.rs` contains a scripted trace source
   that shows the pattern.
4. Document it here and in the roadmap.

No UI changes are needed for typical drivers. Example: a SCPI analyzer driver would declare
`DataKind::Trace`, `amplitude_unit: Dbm`, tuning from the instrument's limits, connection params
`host`/`port`, runtime params such as RBW and reference level, and return `SourceData::Trace`
from `read` after querying `TRACE:DATA?`.

The `.claude/skills/add-source-integration` skill contains the same checklist for AI agents.
