---
id: 0141
from: developer
to: product-manager
type: handoff
subject: 007 review findings applied; npm run check green
work: 007-auto-connect
reply-to: 
date: 2026-11-16T05:00:42-03:00
---

Applied the staff-engineer review (work/007-auto-connect/review-T1-T2.md). Nothing committed.

Changed:
- crates/spectrum-core/tests/autoconnect.rs
  - Race test renamed and rewritten: `a_manual_connect_during_an_auto_attempt_is_never_replaced`. A gated `discover` holds the auto attempt after its "disconnected" read. The manual connect lands, then the auto connect must find a source. Asserts the manual source is kept and only one open happened.
  - Deviation: I gate `discover`, not `open`. `open_locked` sets `Connecting` before the driver open, so a gated open never reaches the stale-read window.
  - Mutation check: removing the guard in `connect_if_idle` fails this test and `connect_if_idle_leaves_a_connected_source_alone`. Source restored afterwards.
  - Failed-watched-connect test: 300 ms sleep replaced by a sentinel (unrelated plug-in; wait until it has been scanned).
  - Added `Gate` helper and `discovers` counter for this.
- crates/spectrum-driver-sa430/tests/autoconnect.rs: 200 ms sleep replaced by a sentinel plug-in, waiting for the second scan.
- crates/spectrum-core/src/autoconnect.rs: "no device at the reported location" raised from debug to info.
- crates/spectrum-core/src/session/mod.rs: comment on `connect_if_idle_with_default_fallback` explaining the double guard.
- docs/sources.md: SA430 hot-plug bullet reflowed; "Linux only" stated once.
- docs/adr/0014-auto-connect-and-device-watch.md and work/007-auto-connect/plan.md: `watchable()`/`watchable_drivers()` and `connect_if_idle_with_default_fallback` added.

Checks:
- `npm run check`: exit 0 (fmt, clippy, cargo test, prettier, eslint, tsc, vitest). `src/bindings` unchanged.
- Threaded autoconnect tests, core (27) and sa430 (3), 5 runs each: 10/10 green.

Not done, by design:
- Core `without_a_watchable_driver...` keeps a 100 ms sleep. No observable event exists there; the test is weak and is marked as such in the plan.
- SA430 `wait_until_scanned` keeps its 50 ms settle; it is setup for a positive test, not a negative one.

Open: T3 QA note from the review still applies (press Play within ~6 s of launch while the coordinator holds the worker lock).
