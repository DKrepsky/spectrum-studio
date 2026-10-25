# ADR 0001 — Tauri 2 with a Rust core and a React/TypeScript UI

Status: accepted (2026-10-25)

## Context

We need a responsive Linux desktop app that processes IQ streams in real time (FFT at tens of
frames per second), talks to USB/serial/network instruments, and ships as AppImage and `.deb`.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| Python + Qt (PySide6, pyqtgraph) | Great scientific ecosystem, SoapySDR bindings | Packaging large; GIL limits real-time DSP; weaker typing |
| Electron + TypeScript | Mature tooling | ~150 MB bundle, DSP in JS, Node in privileged process |
| Native Rust GUI (egui/iced) | Single language, fast | Immature widgets/accessibility; hard UI test automation |
| **Tauri 2 + Rust + React** | Fast, memory-safe DSP and device I/O; small bundles; built-in deb/AppImage bundler; strict IPC permission model; web UI testable with standard tools | Two languages; WebKitGTK rendering differences |

## Decision

Tauri 2. All domain logic lives in a Tauri-independent crate (`spectrum-core`) so it is testable
with `cargo test` and reusable (e.g. a future CLI). The UI is React + TypeScript + Vite with
plots drawn on `<canvas>` by our own small renderer.

## Consequences

- Rust types are exported to TypeScript with `ts-rs` to keep the boundary typed.
- Hardware SDKs (SoapySDR, VISA) are C libraries reachable from Rust via FFI crates.
- The webview is WebKitGTK; we avoid browser features WebKitGTK lacks and test on it via
  `tauri-driver`.
