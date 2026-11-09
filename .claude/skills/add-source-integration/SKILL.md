---
name: add-source-integration
description: Step-by-step procedure for adding a new signal source to Spectrum Studio — an SDR, a traditional spectrum analyzer, or a new transport. Use whenever a new device must be supported.
---

# Adding a source integration

Read `docs/sources.md` first; it defines the `SourceDriver` / `Source` contracts.

1. Create `crates/spectrum-core/src/sources/<name>.rs` (or a sub-module) implementing
   `SourceDriver` (metadata, discovery, parameter specs, `open`) and `Source`
   (`capabilities`, `apply`, `start`, `read`, `stop`).
   - IQ devices return `SourceData::Iq`; instruments that measure spectra return
     `SourceData::Trace` with the instrument's own unit — never convert a trace into fake IQ.
   - Declare only capabilities the device really has (`tuning: None` if it cannot tune).
   - Map device errors to `SourceError` (constructors such as `SourceError::unavailable(msg)`) with a message a user can act on, and attach the original error with `.with_cause(e)`.
   - `read` must return within ~250 ms (use timeouts) so stop/disconnect stays responsive.
2. Put hardware drivers in their own crate `crates/spectrum-driver-<name>` (depends on `spectrum-core`) and register it in `driver_registry()` in `src-tauri/src/lib.rs`. Drivers with no extra dependencies may live in `spectrum-core/src/sources/` and register in `DriverRegistry::with_core_drivers`. If it is not yet
   working, register it with `DriverStatus::Planned` so the UI shows it as unavailable.
3. Tests (required):
   - unit tests for protocol/format parsing with recorded or synthetic fixtures;
   - a session-level test in the driver crate's `tests/` that connects, acquires frames, and
     disconnects through `SessionManager`, including at least one failure path.
4. If the driver needs new user-visible types, run `npm run bindings`. The UI renders driver
   parameters generically from `ParamSpec`; avoid driver-specific UI code.
5. Document the integration in `docs/sources.md` (supported models, settings, limitations) and
   update `docs/roadmap.md`.
6. Run the `verify` skill.
