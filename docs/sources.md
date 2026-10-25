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
| `soapysdr` | SoapySDR devices (RTL-SDR, HackRF, Airspy, …) | SDR / USB | Planned |
| `rtl_tcp` | rtl_tcp server | SDR / Network | Planned |
| `scpi_lan` | SCPI spectrum analyzer (LAN) | Analyzer / Network | Planned |
| `tinysa` | tinySA | Analyzer / Serial | Planned |

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
2. Register it in `DriverRegistry::with_builtin_drivers` (or update the planned entry).
3. Test: protocol/format unit tests plus a session test in `tests/` that connects, acquires and
   disconnects, including one failure path. `tests/session.rs` contains a scripted trace source
   that shows the pattern.
4. Document it here and in the roadmap.

No UI changes are needed for typical drivers. Example: a SCPI analyzer driver would declare
`DataKind::Trace`, `amplitude_unit: Dbm`, tuning from the instrument's limits, connection params
`host`/`port`, runtime params such as RBW and reference level, and return `SourceData::Trace`
from `read` after querying `TRACE:DATA?`.

The `.claude/skills/add-source-integration` skill contains the same checklist for AI agents.
