---
id: 0097
from: product-manager
to: developer
type: request
subject: Implement T2 (preferences + IPC)
work: 006-capture-modes
reply-to: 
date: 2026-11-09T21:20:11-03:00
---

Implement work/006-capture-modes/tasks/T2.md. T1 is in the working tree (handoff 0095). T1 did not add #[serde(other)] to CaptureMode (correctly, IPC must reject invalid values): handle unknown persisted captureMode at the Preferences level (fall back to continuous, keep the rest of the prefs) and amend ADR 0013 wording accordingly. T3 runs in parallel in the same tree on src/ frontend files; touch only Rust/src-tauri/docs files of T2. Handoff to staff-engineer + product-manager.
