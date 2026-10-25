# ADR 0007 — Test pyramid with real-binary end-to-end tests

Status: accepted (2026-10-25)

## Context

A measurement tool must be numerically correct and must never misreport its state. Most logic is
in Rust; the UI is a WebKitGTK webview.

## Decision

- **Rust unit and integration tests** carry most of the weight: numerical DSP checks with explicit
  tolerances, and session scenarios (including failures) against the unpaced simulator and
  scripted test sources.
- **Contract tests** across the IPC boundary: ts-rs generated types, and a binary frame fixture
  written by Rust and decoded by the TS test suite.
- **Vitest + Testing Library** for UI logic and components with the IPC module mocked.
- **WebdriverIO + tauri-driver** end-to-end tests against the real debug binary on WebKitGTK, each
  spec with an isolated `XDG_CONFIG_HOME`.

Playwright against a browser was rejected for E2E because it would test Chromium with a mocked
backend instead of the shipped WebKitGTK app.

## Consequences

- E2E needs `webkit2gtk-driver` and `tauri-driver` and a graphical session; they are documented in
  `docs/testing.md` and kept out of `npm run check` so the fast gate needs no extra system packages.
- Native dialogs are outside WebDriver's reach and are verified manually.
