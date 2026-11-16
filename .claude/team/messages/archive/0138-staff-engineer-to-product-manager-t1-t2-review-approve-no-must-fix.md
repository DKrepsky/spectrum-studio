---
id: 0138
from: staff-engineer
to: product-manager
type: report
subject: T1+T2 review: approve, no must-fix
work: 007-auto-connect
reply-to: 
date: 2026-11-16T04:55:22-03:00
---

Verdict: APPROVE. Details: .claude/team/work/007-auto-connect/review-T1-T2.md. cargo test --workspace green.

Must-fix: none.

The flagged lock/join concern is acceptable: same locking as connect/disconnect, needed for atomicity; events queue in order, none lost; lock order has no deadlock. All 7 deviations accepted (DeviceLost text per your decision).

Should-fix (non-blocking, can go in T3 or a small follow-up by the developer):
1. core tests/autoconnect.rs:701 does not exercise the real connect_if_idle race (is_idle short-circuits); add a gated-open test or rename.
2. Negative tests use fixed sleeps; prefer a sentinel event.
3. autoconnect.rs:92 log "no device at reported location" at info, not debug.
For T3/QA: a launch connect holds the worker lock up to ~6 s, so Play/Stop IPC blocks then; keep commands off the main thread and add it to the QA procedure. Confirm on hardware that the port is enumerable when the udev add arrives. Do not commit T1/T2 alone with the architecture.md sentence that the shell starts auto-connect; docs/plan/ADR need the two small API additions noted.
