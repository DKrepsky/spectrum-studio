---
id: 0123
from: staff-engineer
to: product-manager
type: report
subject: BUG-1 root cause: UI drops the Cancel click during Start in flight; backend discard is correct; T7
work: 006-capture-modes
reply-to: 0122
date: 2026-11-09T22:24:23-03:00
---

Root cause (verified on the real SA430, probes removed, tree restored): neither a late cancel nor a discard bug. The Cancel click is dropped by the UI.

- SA430 sweep = 111 ms. Backend probe: Stop at 10/30/60/100 ms discards the sweep (12/12, stop() returns at ~111 ms, no frame); at 150/200 ms the frame was already published (legit late cancel).
- Real app with file probes: when the label flips to "Cancel single capture" the button is still aria-disabled (store.busy === 'starting', status event arrives before the start invoke resolves). `CaptureControl.onMain` does `if (busyNow) return;`, so the click is lost: no `stop_acquisition` command ever reached the backend (runs with click at 0/5 ms), the sweep completes, frame +1. With the click after the busy window (15-80 ms, even 20 ms before sweep end) Stop arrives, `complete_single deferred=Stop`, no frame (10/10).
- QA's "frame 100 ms after Connected" is sampling (~108 ms poll); backend publishes the frame before Connected and the UI gets it via long-poll afterwards, so that order is normal.

Contract and fix: `.claude/team/work/006-capture-modes/bug1-rootcause.md`, task `tasks/T7.md` (frontend: queue Stop behind the in-flight Start in session.ts, onMain allows the press when acquiring+starting; late-cancel must not announce "cancelled"; deterministic Vitest tests that fail today; deterministic Rust test pinning the discard contract; SA430-gated e2e with an immediate in-page cancel). Rust production code needs no change. Single task, not parallel. Raw logs in screenshots/bug1-*.txt.

Follow-up for you (not in T7): stop() blocks until the in-flight read ends, so Cancel takes up to one sweep to settle (111 ms here, longer for narrow RBW/large spans). Also: Pause during that same 10-25 ms window in Continuous is dropped by the same line; T7 covers it.
