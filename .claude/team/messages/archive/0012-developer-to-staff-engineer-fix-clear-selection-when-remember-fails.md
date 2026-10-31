---
id: 0012
from: developer
to: staff-engineer
type: handoff
subject: Fix: clear selection when remember fails
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:27:08-03:00
---

Fix in crates/spectrum-core/src/remember.rs: when remember_connected returns Err, still warn, now also set_last_source_id(None) (persisted). Connect still reports success. No change needed in store.rs or src-tauri (apply_source_settings already writes nothing when last_source_id is None).
Test added in tests/remember.rs: unrememberable_connect_clears_the_selection_so_settings_go_nowhere (200 entries of unavailable driver "nope", selected full-0, connect sim -> Connected, entries unchanged, last_source_id None, follow-up settings update writes nothing).
Checks: cargo fmt --check, clippy -D warnings, cargo test --workspace all pass. Did not touch src/. Nothing committed.
