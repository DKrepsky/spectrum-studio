# Architecture

Spectrum Studio is a Tauri 2 desktop application. A Rust backend owns devices, signal processing,
files and persistence; a React/TypeScript frontend renders the instrument UI inside the system
WebKitGTK webview. Everything runs locally — there is no server, account or network dependency.

```
┌──────────────────────────── WebView (React + TS) ───────────────────────────┐
│ Toolbar · Source manager · Spectrum canvas · Waterfall · Markers · Peaks    │
│        ▲ SessionStatus events          ▲ binary frames (next_frame poll)    │
└────────┼───────────────────────────────┼────────────────────────────────────┘
         │ invoke(commands)              │
┌────────┴───────────── src-tauri (thin shell) ───────────────────────────────┐
│ commands.rs: validate args → SessionManager / Store / export                │
│ sink.rs: SessionSink → Tauri events · native save dialog for export        │
└────────┬────────────────────────────────────────────────────────────────────┘
         │ plain Rust API
┌────────┴──────────────── crates/spectrum-core ──────────────────────────────┐
│ session/   SessionManager + acquisition worker thread (state machine)       │
│ sources/   SourceDriver/Source traits, registry, simulator, files, planned  │
│ dsp/       windows, FFT → power spectrum, averaging, holds, peak search     │
│ model/     units, params, capabilities, settings, frames, session status    │
│ formats/   SigMF / raw IQ readers, CSV trace import/export                  │
│ store.rs   versioned JSON persistence (preferences, saved sources)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module boundaries

| Module | Responsibility | Must not |
| --- | --- | --- |
| `model` | Plain data types shared by all layers (serde + ts-rs). | Contain behaviour beyond validation. |
| `dsp` | Pure numeric functions/structs. Deterministic, no I/O, no threads. | Know about sources or UI. |
| `sources` | Talk to devices/files; expose capabilities; produce `SourceData`. | Do spectrum post-processing or UI logic. |
| `session` | One active source at a time; lifecycle, threading, error recovery, feeding the DSP pipeline. | Know about specific devices. |
| `formats` | Parse/write files with explicit validation errors. | Touch the session. |
| `store` | Load/save JSON atomically, migrate/repair. | Hold application state. |
| `src-tauri` | Translate IPC ⇄ core API; choose filesystem paths; native dialogs. | Contain domain logic. |
| `src/` (UI) | Present state, collect user intent, draw plots. | Compute spectra or assume backend state. |

## Data flow during acquisition

1. The UI calls `connect_source(config)`. `SessionManager` stops and joins any previous worker, then
   spawns a worker thread that opens the source through its driver. Status transitions
   (`Connecting` → `Connected` or `Disconnected { error }`) are pushed as `SessionStatus` events.
2. `start_acquisition` puts the worker into its acquisition loop:
   `source.read()` → `SourceData::Iq` goes through `SpectrumEstimator` (window + FFT + dBFS
   normalisation); `SourceData::Trace` is used as supplied. Both then pass through
   `TraceProcessor` (averaging, max/min hold, peak search) to build a `SpectrumFrame`.
3. Frames are encoded once into a compact binary message (JSON header + `f32` arrays) and kept in
   a latest-wins slot. The UI pulls them with the long-polling `next_frame` command
   ([ADR 0003](adr/0003-binary-frame-transport.md)), decodes them into a frame store outside React
   state, and the canvases redraw on `requestAnimationFrame`; text readouts refresh at 2–4 Hz.
   React re-renders are not on the hot path.
4. Commands that change settings while running are queued to the worker and applied between reads;
   the next frame reflects the new settings (frames carry their own settings in the header so the
   UI never labels a frame with settings that did not produce it).

Because the UI asks for the next frame only after handling the previous one, a slow UI skips
frames instead of queueing them, so latency stays bounded.

## Lifecycle and failure handling

`SessionState` is the single source of truth: `Disconnected`, `Connecting`, `Connected`,
`Acquiring`, `Stopping`. Any error is attached to the status as `last_error` with a user-facing
message. Rules:

- Switching sources always runs stop → close → join before opening the new source.
- A read error or end of stream stops acquisition, closes the source when the device is gone, and
  emits the error; the UI offers *Reconnect* using the remembered configuration.
- The UI marks the plot as **not live** when acquisition is not running or no frame has arrived for
  longer than a timeout, so stale data is never presented as current.

## Extensibility

New hardware is added by implementing two traits in `sources/` and registering the driver (see
`docs/sources.md`). Sources describe themselves with `Capabilities` (output kind, tuning range,
sample rates, amplitude unit) and a list of generic `ParamSpec`s for device-specific settings; the
UI renders forms and enables controls from these descriptions, so most integrations need no UI
code.

## Security

- No remote content: the CSP allows only bundled assets; the webview never loads URLs.
- Tauri capabilities grant only core IPC/events and the dialog plugin's *open* dialog (to pick
  recordings). Export opens the native save dialog from Rust, so the webview can never choose a
  path to write. Files are only read by the format parsers, which validate everything they read.
- All IPC inputs are deserialised into typed structs and validated (`validate()` methods) before use.
- Persisted files are written atomically (temp file + rename); corrupt files are backed up and
  replaced with defaults instead of crashing the app.

See `docs/adr/` for the reasoning behind these choices.
