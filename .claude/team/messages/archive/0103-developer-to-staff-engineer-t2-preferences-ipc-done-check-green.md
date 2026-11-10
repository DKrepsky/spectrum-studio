---
id: 0103
from: developer
to: staff-engineer
type: handoff
subject: T2 preferences + IPC done, check green
work: 006-capture-modes
reply-to: 0097
date: 2026-11-09T21:23:32-03:00
---

T2 (preferences, set_capture_mode IPC, SA430 single test) implemented, uncommitted. `npm run check` EXIT 0 (includes T3's in-progress frontend files as they stood at the run). `cargo test --workspace` all green, `cargo clippy --workspace --all-targets -D warnings` clean, `cargo fmt --check` clean.

Changes
- crates/spectrum-core/src/store.rs: `Preferences.capture_mode: CaptureMode` (`#[serde(default, deserialize_with = "lenient_capture_mode")]`). The lenient fn reads a serde_json::Value and falls back to Continuous on anything invalid (unknown string, number, null), so only that field is lost; the file is not reset and no warning is raised. The `CaptureMode` enum itself is unchanged (no serde(other)), so IPC still rejects bad values (asserted in a test).
- src-tauri/src/commands.rs: `set_capture_mode(mode: CaptureMode)` (async, `blocking`, session first, then `update_preferences`; persist failure -> "The setting was applied but not saved: ..." like set_processing).
- src-tauri/src/lib.rs: registered in the handler list; `SessionManager::new(...).with_capture_mode(preferences.capture_mode)`.
- crates/spectrum-driver-sa430/tests/session.rs: `manager_with_links_in(ports, links, mode, capture_timeout)` helper (old helper delegates); 2 new tests:
  - `single_capture_takes_one_sweep_then_stops_by_itself`: two sweeps queued, one frame, state Connected, no further frame and no notice after 300 ms; a second start captures a newer frame.
  - `single_capture_without_a_sweep_fails_and_stays_connected`: 200 ms bound, AcquisitionFailed "Single capture failed...", state Connected, no frame, source kept.
  Each repeated 15 times, no flakes.
- docs/adr/0013-capture-modes.md: persistence bullet rewritten (no serde(other); lenient field deserialiser `lenient_capture_mode` instead).
- src/bindings/Preferences.ts regenerated (`captureMode: CaptureMode`), via `npm run bindings`. CaptureMode.ts and SessionStatus.ts unchanged by this.

Tests added (store, spectrum-core)
- capture_mode_defaults_to_continuous (default and serialised as "continuous")
- capture_mode_persists_across_reopen (Single survives reopen, no warnings)
- unknown_stored_capture_mode_loads_as_continuous_and_keeps_the_rest (display and lastSourceId kept, no warnings; "burst" rejected by the typed enum)
- a_non_string_stored_capture_mode_also_loads_as_continuous

Deviations / notes
- Unknown persisted value is silent (no warning in `store.warnings()`), by design per the PM note: the fallback is the documented default. Say if you want a warning surfaced; that would need a raw pre-parse in open_with.
- No Rust unit test for the `set_capture_mode` command body in src-tauri (the crate has no command tests today; the logic is the core `set_capture_mode` tests from T1 plus the typed argument).
- Did not touch docs/sources.md (T5), src/ (T3), or commit.

Files: crates/spectrum-core/src/store.rs, crates/spectrum-driver-sa430/tests/session.rs, src-tauri/src/commands.rs, src-tauri/src/lib.rs, docs/adr/0013-capture-modes.md, src/bindings/Preferences.ts
