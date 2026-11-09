# Sources

Code: `crates/spectrum-core/src/sources/`. Decision record: [ADR 0004](adr/0004-source-abstraction.md).

## Model

```rust
trait SourceDriver: Send + Sync {          // one per integration type
    fn info(&self) -> DriverInfo;           // name, kind, transport, status, connection params
    fn discover(&self) -> Result<Vec<DeviceDescriptor>, SourceError>;   // optional, enumerates only
    fn open(&self, config: &SourceConfig) -> Result<OpenedSource, SourceError>;
    fn normalize_device_id(&self, id: Option<&str>, label: &str) -> Option<String>; // migration
}

trait Source: Send {                         // an open connection, used by one worker thread
    fn capabilities(&self) -> &Capabilities; // data kind, tuning range, spans, unit, params
    fn settings(&self) -> &SourceSettings;   // centre, span, param values in effect
    fn apply(&mut self, patch: &SettingsPatch) -> Result<(), SourceError>;
    fn start(&mut self) -> Result<(), SourceError>;
    fn read(&mut self, samples_wanted: usize) -> Result<SourceData, SourceError>; // ≤ ~250 ms
    fn stop(&mut self) -> Result<(), SourceError>;
}

enum SourceData { Iq(IqBlock), Trace(TraceBlock) }
```

- **DriverInfo.kind:** `Sdr`, `SpectrumAnalyzer`, `Simulator` — how the UI groups sources.
- **DriverInfo.transport:** `Usb`, `Serial`, `Network`, `Internal` — shown as a badge.
- **DriverInfo.status:** `Available` or `Planned` (cannot be opened). `list_drivers` still returns
  planned drivers, but the UI does not show them anywhere (menu, forms): nothing that cannot work is
  offered. They stay in `docs/roadmap.md` and in the registry so the plan remains tracked.
- **Capabilities** declare only what the source really supports. `tuning: None` hides tuning;
  an empty `span_options_hz` means a fixed span; `amplitude_unit` is the truth about calibration.
- **Discovery** (`discover`) only *enumerates*: it lists devices from the OS (udev, serial ports)
  and must never open, probe or reset a device, because the UI calls it every few seconds while
  the source menu is open, also while another source is acquiring. Drivers that cannot enumerate
  without opening set `supports_discovery: false`. `discover_all` runs every available driver
  with discovery (not `internal`) one at a time; a failing driver is reported in its
  `error` and does not hide the others.
- **ParamSpec** describes device-specific settings (number with range/unit, choice, bool, text).
  The UI renders forms from them; the core validates submitted values against them
  (`model/params.rs`), so drivers receive only valid, complete parameter maps.

### Device identity ([ADR 0010](adr/0010-stable-device-identity.md))

A remembered source follows the *device*, not the port it happened to be on. The contract for
drivers that talk to hardware:

- **`SourceConfig.device_id` is a stable identity chosen by the driver**, never invented by the
  caller: for the SA430 its serial number, else `port:<name>` (explicitly unstable). It is what the
  store matches on. `SourceConfig.connection` (for the SA430 the `port`) is only a *hint* of where
  the device was last found.
- **`open` resolves by identity first**, falls back to the hint, verifies the identity of the
  device it actually opened, and fails with an "Expected X but P is Y" message on a mismatch. A
  caller never silently receives a different device.
- **`OpenedSource.device_id` and `.connection`** report the identity and the connection actually
  used. The session writes them into `ActiveSource.config`, so a remembered entry is always saved
  with its identity filled in and a fresh hint.
- **`DeviceDescriptor.location`** is the transport address (the port) of a *discovered* device. The
  UI uses it to pre-fill the Add/Edit dialog; it is not identity.
- **`normalize_device_id(id, label)`** lets a driver translate legacy ids (for the SA430 a port
  name or none, plus the automatic label) into the stable identity when `sources.json` is
  migrated. It returns `None` when it cannot, and the entry is then kept as it was.
- **`discover` only enumerates.** It never opens, probes or resets a device; the UI calls it every
  few seconds while the menu is open, also during acquisition. Identity that needs an open (the
  calibration serial) is read by `open` and by `test_source`, never by `discover`.
- **`test_source(driver_id, connection)`** opens the device with exactly the given connection,
  reads its identity, closes it and returns a `SourceTestResult { ok, message, deviceId, label,
  inUse }` without touching the session: no `SessionStatus` is emitted, no revision is bumped and
  an acquisition of another source continues. If the port belongs to the active source it returns
  `inUse` instead of opening it a second time. Failures carry the driver's message verbatim.

### Remembered sources

The user rarely saves sources by hand. A successful connect (`connect_source` for a new device,
`connect_remembered` for a listed one) upserts an entry in `sources.json` identified by
`driverId` + `deviceId` (device sources; the connection is ignored) or by `driverId` + `connection`
(simulator presets); stores the device label reported at connect time, and keeps the
entry's effective settings up to date while it is in use (`apply_source_settings`). Records that
share an identity are *merged*, never duplicated. A failed connect remembers nothing. The user can
also create (`add_source`) and edit (`update_source`) entries without connecting; both are
validated in Rust (unique name, unique identity, connection locked on the live source, simulator
entries can only be renamed). Entries whose driver is unknown, removed or `Planned` are hidden
from the UI but preserved verbatim in the file (for example the entries of the removed file
readers, see [ADR 0011](adr/0011-remove-file-sources.md)). Presence ("Not detected") is derived by matching a
remembered entry's `driverId` + `deviceId` against the latest discovery result, only for drivers
that support discovery. Rationale and schema: [ADR 0009](adr/0009-automatic-source-memory.md),
[ADR 0010](adr/0010-stable-device-identity.md).

### Errors

| `SourceErrorKind` | Meaning | Session reaction |
| --- | --- | --- |
| `Unavailable` | Cannot open (missing, busy, permission) | Connect fails, notice shown |
| `InvalidSettings` | Settings rejected | Command fails, previous settings kept |
| `Io` | Recoverable read problem | Acquisition stops, *Restart* offered |
| `Disconnected` | Device gone | Source closed, *Reconnect* offered |
| `Unsupported` | Not implemented | Shown as is |

Build errors with the constructors (`SourceError::unavailable("…")`, `::io`, `::disconnected`,
`::invalid_settings`, `::unsupported`) and match on `error.kind()`. Messages are shown to the user
verbatim — write complete, actionable sentences. When a lower-level error caused the failure, attach
it with `.with_cause(e)`; it stays out of the UI text but is available through
`std::error::Error::source()` for logging.

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
- **Identity ([ADR 0010](adr/0010-stable-device-identity.md)):** `deviceId` is the device's serial
  number (the USB serial, verified equal to the calibration serial on real hardware), or
  `port:<port name>` when a port reports none or two ports report the same serial. The `port`
  connection param is only a hint. `open` finds the device by serial through a scan, falls back to
  the hint, checks the calibration serial it reads, and fails with an "Expected SA430 X but P is
  SA430 Y" message on a mismatch. `OpenedSource` reports the serial and the port actually used.
  `normalize_device_id` migrates legacy port-name ids using the label or a scan.
- **Discovery:** USB scan by vendor/product id (udev on Linux); connecting without a chosen device
  or port uses the first one found. `discover` only enumerates (it never opens the device), so it
  is safe while the analyzer is acquiring. The port name is reported as the device `location`.
  Needs `libudev` at build/run time and membership of the `dialout` group.
- **Bands:** the instrument measures 300–348, 389–464 and 779–928 MHz; a sweep cannot cross
  bands. Centre and span select the window; if it sticks out of the band it is **shifted** back
  inside (the reported centre is the one actually swept). A centre between bands or a span wider
  than its band is rejected.
- **Settings:** spans 1–149 MHz; *Frequency step* 10–500 kHz; *Reference level* −35…−70 dBm.
- **Sweep time** is ≈1.3 ms per point and a sweep cannot be interrupted, so requests above 800
  points (~1 s) are rejected with a hint to raise the step. Stop/Disconnect therefore take effect
  after the current sweep, which can exceed the usual 250 ms `read` budget for large sweeps.
- **Connect ([ADR 0012](adr/0012-sa430-connect-handshake.md)):** right after plug-in the analyzer
  corrupts the first frame sent within ~20 ms of the port opening. The driver therefore opens the
  port with the `sa430` crate's `SerialPortChannel::with_settle` (200 ms settle, then the input is
  cleared; the driver has no serial dependency of its own) and reads the calibration as the handshake.
  The handshake uses a 600 ms read timeout (never past the connect deadline) and is retried up
  to 4 times on a fresh port (pauses 150/300/600 ms, 6 s overall). Retried: timeouts, device
  error or no-frame-start replies, and a busy or vanished port at open. A serial mismatch or
  invalid settings are not retried. The sweep timeout (5 s) applies once the handshake succeeded.
  "Connected" is reported only after the calibration was read; a dead port fails in at most 6 s
  with the "did not answer like an SA430" message.
- **Errors:** open failures explain `dialout`/unplugged causes; a read timeout is recoverable
  (*Restart*); a broken pipe or serial error disconnects the session.
- **Tests:** `crates/spectrum-driver-sa430/tests/session.rs` runs the session against the library's mock channel (including
  a glitched first connect, a device that never answers, silent device and unplugging). The unit
  tests in `src/lib.rs` script the connect attempts. `tests/hardware.rs` needs a real analyzer:
  `SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430 --test hardware -- --ignored
  --test-threads=1 --nocapture` runs 10 connect cycles, reboot-then-connect (with and without
  settle), the USB serial check and sweeps after connect. Stop the app first: the port is exclusive.

### Simulator

A virtual tunable receiver (0–6 GHz, 250 kS/s – 10 MS/s) observing a fixed scene of emitters at
absolute frequencies; an ideal anti-alias filter removes anything outside ±fs/2, and the ADC
saturates at full scale. Simulated time advances by 1/30 s per block and samples come from a
documented PRNG ([ADR 0005](adr/0005-deterministic-simulator.md)), so output depends only on the
seed and settings. Fault injection: *Fail to connect* (connection option) and *Simulate device
loss after N s* (runtime setting). Parameters are listed in the [user guide](user-guide.md#simulator).

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
