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
- Types crossing the IPC boundary derive `Serialize`/`Deserialize` and, behind the `bindings` feature, `ts_rs::TS` (`#[cfg_attr(feature = "bindings", derive(ts_rs::TS))]`), use
  `#[serde(rename_all = "camelCase")]`, and provide `validate()` when they carry user input.
- Blocking work (device I/O, file parsing) never runs on the Tauri main thread: use the session
  worker or `spawn_blocking`.
- Threads are always joined; resources are released in `Drop` or explicit `close`.
- Log with `tracing` (`info!`/`warn!`/`error!` with structured fields), never `println!`/`eprintln!`.
  Library crates only emit events; the application installs the subscriber.

## TypeScript / React

- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`). No `any`.
- Backend types come from `src/bindings` (generated). IPC calls go through `src/ipc/` only.
- Global UI state lives in a small zustand store; high-rate data (frames) lives outside React
  state and is drawn on canvas in `requestAnimationFrame`.
- Components stay presentational where possible; logic goes into plain, unit-tested modules.
- **Build UI from `src/ui/`.** A button, icon button, field, select, checkbox, badge, banner, menu,
  popover, dialog, table or status element is a `src/ui/` component; feature code in
  `src/components/` composes them and maps its state to their props. Do not add a raw `<button>`,
  `<input>` or `<select>` or a copy of an existing element in feature code. A new element goes into
  `src/ui/` once a second screen needs it (DESIGN.md 10.2).
- **`src/ui/` is presentational.** It imports React, `src/format/` and its own files only. No IPC,
  `src/state`, `src/bindings`, `src/plot`, `src/components`, Tauri or zustand, not even as a type.
  ESLint and `src/ui/boundary.test.ts` enforce it (ADR 0015).
- **Tokens, not values.** Colours, sizes, radii, shadows, z-index and opacity come from
  `src/styles/tokens.css` (`var(--token)` in CSS). Do not write a colour or size literal in CSS or
  TSX; a value that is missing from the token file gets a semantic token first (DESIGN.md 2.17,
  2.19 and 10.1). React emits class names; inline styles are for plot geometry only.
- **Formatting** of numbers, frequencies, levels and rates goes through `src/format/` (DESIGN.md 7.5).
- **Design source.** [DESIGN.md](../DESIGN.md) at the repo root is the design system (rules, tokens,
  component catalogue, accessibility). A UI change that touches a screen comes with before and after
  screenshots of the states it affects (DESIGN.md 10.4), and the component entry in DESIGN.md is
  updated in the same change.
- Prettier formatting, ESLint (typescript-eslint strict + react-hooks).

## Testing

- Every bug fix gets a regression test.
- Rust unit tests next to the code; cross-module scenarios in `crates/spectrum-core/tests/`.
- Frontend logic (decoding, scales, formatting, markers) gets Vitest tests; components get
  Testing Library tests with the IPC layer mocked.
- Every `src/ui/` component has tests for render, variants, states and keyboard or ARIA behaviour.
  The token, boundary and CSS-import guards run in `npm test` (see [testing.md](testing.md)).
- End-to-end tests drive the real app via WebDriver for the main workflows.

## Definition of done

1. Works in the running app (verified, not assumed).
2. Tests cover the behaviour, including failure paths.
3. `npm run check` passes.
4. Docs updated; follow-up work opened as GitHub issues; ADR added for significant decisions.

## Commits

Small, focused commits with imperative subject lines (`Add peak search to trace processor`).
