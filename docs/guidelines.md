# Engineering guidelines

These apply to humans and AI agents alike.

## Principles

- **Correctness first.** A spectrum analyzer that shows wrong numbers is worse than none. DSP code
  gets numerical tests with explicit tolerances.
- **KISS and YAGNI.** Add an abstraction when a second real implementation needs it, not before.
  The source traits exist because simulator, files and future hardware already differ.
- **Single responsibility.** Follow the module boundaries in `architecture.md`.
- **Honest UI.** Never show a device, connection, acquisition, unit or calibration that is not real.

## Rust

- Edition 2024, `cargo fmt`, `cargo clippy --all-targets -- -D warnings`.
- Errors: `thiserror` enums per module; messages are complete sentences a user can act on.
  No `unwrap()`/`expect()` outside tests except for documented invariants.
- Types crossing the IPC boundary derive `Serialize`/`Deserialize` and `ts_rs::TS`, use
  `#[serde(rename_all = "camelCase")]`, and provide `validate()` when they carry user input.
- Blocking work (device I/O, file parsing) never runs on the Tauri main thread: use the session
  worker or `spawn_blocking`.
- Threads are always joined; resources are released in `Drop` or explicit `close`.

## TypeScript / React

- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`). No `any`.
- Backend types come from `src/bindings` (generated). IPC calls go through `src/ipc/` only.
- Global UI state lives in a small zustand store; high-rate data (frames) lives outside React
  state and is drawn on canvas in `requestAnimationFrame`.
- Components stay presentational where possible; logic goes into plain, unit-tested modules.
- Prettier formatting, ESLint (typescript-eslint strict + react-hooks).

## Testing

- Every bug fix gets a regression test.
- Rust unit tests next to the code; cross-module scenarios in `crates/spectrum-core/tests/`.
- Frontend logic (decoding, scales, formatting, markers) gets Vitest tests; components get
  Testing Library tests with the IPC layer mocked.
- End-to-end tests drive the real app via WebDriver for the main workflows.

## Definition of done

1. Works in the running app (verified, not assumed).
2. Tests cover the behaviour, including failure paths.
3. `npm run check` passes.
4. Docs and `docs/roadmap.md` updated; ADR added for significant decisions.

## Commits

Small, focused commits with imperative subject lines (`Add peak search to trace processor`).
