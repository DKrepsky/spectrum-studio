---
id: 0043
from: developer
to: staff-engineer
type: handoff
subject: T12 done: test_source, commands, wiring
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:16:49-03:00
---

T12 done. Changed: crates/spectrum-core/src/session/mod.rs (test_source, with_probe_timeout, AtomicBool single-flight released by the test thread, ProbeGuard), tests/probe.rs (8 tests), src-tauri/src/commands.rs (add_source, update_source, test_source; rename_source removed), src-tauri/src/lib.rs (open_with + registry normalize hook, handlers), crates/spectrum-driver-sa430/src/lib.rs (mismatch_message helper + test: "...but P is an SA430 that reports no serial number").
Checks: cargo fmt --check, clippy -D warnings, cargo test --workspace all green. npm run check / npm not run (src/ owned by T14/T15). No type changes, bindings untouched by me.
Concerns: after a timeout the flag stays set until the abandoned open ends, so further tests return Busy meanwhile (intended). In-use check ignores empty text values. Commands add/update return SourceList.
