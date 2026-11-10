---
id: 0104
from: developer
to: product-manager
type: handoff
subject: T2 done (copy): persistence + IPC + SA430 single test
work: 006-capture-modes
reply-to: 0097
date: 2026-11-09T21:23:32-03:00
---

T2 done, uncommitted, check green. Details in the handoff to staff-engineer. Summary: Preferences.captureMode persisted with a lenient loader (unknown value -> continuous, rest of file kept); set_capture_mode IPC (typed, rejected while acquiring, persisted after apply); lib.rs wires the mode into SessionManager; two SA430 single-capture tests; ADR 0013 wording amended to match. Files: crates/spectrum-core/src/store.rs, crates/spectrum-driver-sa430/tests/session.rs, src-tauri/src/commands.rs, src-tauri/src/lib.rs, docs/adr/0013-capture-modes.md, src/bindings/Preferences.ts.
