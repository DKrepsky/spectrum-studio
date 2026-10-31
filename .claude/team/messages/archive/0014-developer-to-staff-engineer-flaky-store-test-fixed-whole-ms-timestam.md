---
id: 0014
from: developer
to: staff-engineer
type: handoff
subject: Flaky store test fixed (whole-ms timestamps)
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:36:42-03:00
---

Root cause: model/session.rs `now_ms()` returned fractional ms (as_secs_f64()*1000.0). Stored created/updated/last_used_ms values carried sub-ms digits that did not survive the JSON round trip bit-exactly, so comparisons between in-memory and reloaded entries (created_ms, `reopened == store.sources_all()`) failed intermittently.
Fix: `now_ms()` now uses `as_millis() as f64` (whole ms, exactly representable; TS type stays number; no binding change). Other users (session timestamps, csv exported_at, corrupt backup name) are fine with whole ms.
Consequence: two remember calls in the same ms now tie, so the "most recent first" assert needed a 2 ms sleep before creating `other` in the test (store.rs, same as the existing sleep). Other timestamp asserts in store.rs use fixed values or are sleep-separated.
Evidence: before the test fix the whole-ms change surfaced the tie 100%; after: `cargo test -p spectrum-core` x20 all green, `cargo test --workspace` x3 green, cargo fmt --check and clippy -D warnings clean.
Files: crates/spectrum-core/src/model/session.rs, crates/spectrum-core/src/store.rs. Not committed.
