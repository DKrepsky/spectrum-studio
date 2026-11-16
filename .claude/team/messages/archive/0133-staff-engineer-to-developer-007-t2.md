---
id: 0133
from: staff-engineer
to: developer
type: request
subject: 007 T2
work: 007-auto-connect
reply-to: 
date: 2026-11-16T04:43:05-03:00
---

# T2 SA430 driver: hot-plug watcher

Read `../plan.md` section 5. Depends on the trait in T1 section 1 (agree the signature as written; merge
after T1). Parallel with T1; touches only the driver crate.

Files: `crates/spectrum-driver-sa430/src/lib.rs` (+ `tests/` session test), `docs/sources.md` (SA430 section:
hot-plug, limitations).

Acceptance: `Sa430Backend::watch` (real: `sa430::create_monitor()?.run(handler)`; the fake backend in the
tests replays scripted `sa430::Event`s); `Sa430Driver::supports_watch() == true`; `watch` maps
`DeviceAdded/Removed(port)` to `DeviceEvent { location: Some(port.name()) }`, honours `Break`, maps errors to
`SourceError::unavailable(..).with_cause(e)` with an actionable message. No new dependency, no change to the
sa430 repo. Hardware specifics stay in this crate.

Tests: event mapping (added, removed, order, Break stops), error mapping, `supports_watch`; a session-level
test in `tests/` using `AutoConnect` (from T1) with the fake backend: Added -> Connected (paused), Removed ->
Disconnected with DeviceLost, failed open -> ConnectFailed and a later Added connects. Optionally an ignored
hardware test (`#[ignore]`) that waits for a real event. `npm run check` green.
