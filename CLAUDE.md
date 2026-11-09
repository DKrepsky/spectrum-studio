# Spectrum Studio — agent guide

Spectrum Studio is a local-first desktop spectrum analyzer for Linux (Tauri 2: Rust backend,
React + TypeScript frontend). Read `docs/README.md` for the documentation index before making
non-trivial changes; `docs/architecture.md` explains module boundaries.

## Repository map

- `crates/spectrum-core/` — pure Rust domain library: units, DSP, source abstraction, simulator,
  acquisition session. No Tauri dependency; most logic and tests live here.
- `crates/spectrum-driver-*/` — one crate per hardware driver (e.g. `spectrum-driver-sa430`); depend on
  `spectrum-core`, registered by `src-tauri`.
- `src-tauri/` — thin Tauri shell: IPC commands, event/channel bridge, persistence paths, packaging.
- `src/` — React UI. `src/bindings/` is **generated** from Rust by ts-rs (`npm run bindings`); never
  edit it by hand.
- `e2e/` — WebdriverIO + tauri-driver end-to-end tests against the real built app.
- `docs/` — architecture, DSP notes, source integration guide, ADRs (`docs/adr/`).

## Commands

| Task | Command |
| --- | --- |
| Run the app in dev mode | `npm run tauri dev` |
| All checks (format, lint, types, tests) | `npm run check` |
| Rust tests only | `cargo test --workspace` |
| Frontend unit tests | `npm test` |
| Regenerate TS bindings | `npm run bindings` |
| End-to-end tests | `npm run e2e` (needs `webkit2gtk-driver`, see `docs/testing.md`) |
| Release bundles (.deb, AppImage) | `npm run tauri build` |

## Rules for changes

- Run `npm run check` after every significant change and fix failures before moving on.
- A feature is done only when it works end to end and is covered by tests — UI existing is not enough.
- Hardware/format specifics stay inside a source driver (`crates/spectrum-driver-*/`, or `crates/spectrum-core/src/sources/` for dependency-free ones). The
  UI, DSP and session code must not know about specific devices. See `docs/sources.md`.
- Never fabricate devices or show an unimplemented integration as working. Unimplemented drivers are
  listed with `DriverStatus::Planned` and cannot be connected.
- Amplitudes carry an explicit `AmplitudeUnit`. IQ-derived spectra are dBFS unless a calibration is
  applied; never label uncalibrated data as dBm.
- The UI reflects backend state only (`SessionStatus` events); it never assumes a connection or
  acquisition succeeded.
- Validate all input crossing a boundary (IPC arguments, files, persisted JSON) in Rust.
- Change a Rust type exposed to the UI → run `npm run bindings` and commit the regenerated files.
- Keep dependencies minimal; justify new ones in the PR/commit message or an ADR.
- Record significant technical decisions as a new ADR in `docs/adr/`.
