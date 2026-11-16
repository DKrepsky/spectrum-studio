---
id: 0132
from: staff-engineer
to: developer
type: request
subject: 007 T1
work: 007-auto-connect
reply-to: 
date: 2026-11-16T04:43:05-03:00
---

# T1 Core: watch capability, session guards, remember, auto-connect policy

Read `../plan.md` (sections 1-4) and `docs/adr/0014-auto-connect-and-device-watch.md`. Parallel with T2
(T2 only needs the trait from section 1; do that first and commit it early). T3 depends on this.

Files: `crates/spectrum-core/src/sources/mod.rs` (DeviceEvent, trait methods, re-export),
`crates/spectrum-core/src/session/mod.rs` (`connect_if_idle`, `device_removed`),
`crates/spectrum-core/src/remember.rs` (`auto_connect`), new `crates/spectrum-core/src/autoconnect.rs`,
`crates/spectrum-core/src/lib.rs` (export), `crates/spectrum-core/tests/` (fake-watcher tests), `docs/sources.md`,
`docs/architecture.md` (short paragraph).

Acceptance: behaviour exactly as plan.md section 4 (launch / Added / Removed / no retry / never replace /
never start acquisition / watcher failure contained / shutdown flag). Simulator is never auto-connected.
Policy functions are synchronous and callable from tests; threads are a thin layer.
Successful auto-connect is remembered with stored settings and sets `lastSourceId` as a manual pick does.
Mind lock order (worker lock, never held across `discover`). No new dependencies.

Tests required (fake driver with scripted discover/open/watch, `SessionManager` with `NullSink`/recording
sink, temp store): every case listed under "Test plan / Core" and "Session tests" in plan.md, including
open-called-once on failure, manual disconnect then no activity, Removed while paused, Added while
simulator is connected, unknown location, `connect_if_idle` returning `None`, thread ends on watcher
error and on `shutdown`. `npm run check` green; `npm run bindings` yields no diff.
