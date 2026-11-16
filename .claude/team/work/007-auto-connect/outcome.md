# 007 Auto-connect — outcome
Accepted by the human 2026-11-16 ("Works; fix e2e, commit") after a physical unplug/replug test.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Launch with SA430 → connected, paused | PASS | qa.md, screenshots/qa-launch-1440-sa430-paused.png, e2e `sa430` |
| Plug-in while idle → auto-connect | PASS | QA re-enumeration ×2 (~1.2 s), human physical replug |
| Two devices → first discovered | PASS (tests only) | core autoconnect tests; no second SA430 available |
| Never replaces an active source | PASS | QA simulator-acquiring + re-enumeration; race test with mutation check |
| Unplug → prompt DeviceLost, replug reconnects | PASS | core/driver tests, human physical test (paused and acquiring) |
| Manual disconnect / failure → no retry | PASS | QA 12 s / 15 s sampling, e2e `sa430` manual-disconnect case |
| Simulator never auto-connected; no-hardware launch unchanged | PASS / tests only | QA simulator-remembered case; no-hardware e2e branch not run |
| Remembered like a manual connect | PASS | QA relaunch: stored centre applied |
| Device-agnostic boundaries | PASS | staff-engineer review-T1-T2.md, ADR 0014 |
| Tests, `npm run check` green | PASS | PM ran `npm run check` (exit 0); full e2e 8/10 files, 5 failing checks pre-existing (roadmap) |

Deferred (docs/roadmap.md Known limitations): no-hardware e2e branch unrun; two devices at launch; watcher thread not wakeable
(optional sa430 lib follow-up).
