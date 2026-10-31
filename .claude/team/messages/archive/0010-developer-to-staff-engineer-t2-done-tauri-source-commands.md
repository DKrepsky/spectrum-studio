---
id: 0010
from: developer
to: staff-engineer
type: handoff
subject: T2 done: Tauri source commands
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:24:12-03:00
---

Changed:
- NEW crates/spectrum-core/src/remember.rs (+ `pub mod remember;` in lib.rs): connect_remembered(session, store, id) and connect_new(session, store, config). Orchestration lives in core, unit-testable.
- NEW crates/spectrum-core/tests/remember.rs (7 tests): success remembers+selects (re-connect touches, no duplicate); failure remembers nothing and writes no sources.json; connect-by-id touches only that entry; unknown id errors; stale-settings retry stores effective defaults; failed remembered pick keeps lastSourceId; persistence failure (sources.json is a dir) does not fail connect.
- src-tauri/src/commands.rs: added list_sources, discover_all, connect_remembered, rename_source, forget_source, restore_source; connect_source now upserts on success only; apply_source_settings writes effective settings to preferences.lastSourceId (warn on failure); removed save_source, delete_saved_source, list_saved_sources and the last_source write. rename/forget/restore return SourceList. src-tauri/src/lib.rs handler list updated. No binding changes needed.
Validation is in the core store (rename length, restore checks, unknown id); connect paths keep resolve_params validation.
Checks: cargo fmt --check, clippy --workspace --all-targets -D warnings, cargo test --workspace all green. npm run check not run (T3 is editing src/).
Behaviour notes: connect_remembered sets lastSourceId at attempt start and again after remember; on remember_connected Err (cap) it logs a warning and the connect still succeeds. connect_source does not use the stale-settings fallback (ad hoc config), only connect_remembered does.
Concerns: if connect_source cannot remember (cap with no evictable entry) lastSourceId is unchanged, so a later apply_source_settings would write settings onto the previously selected entry. Rare edge; could clear lastSourceId in that case if you want.
