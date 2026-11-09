# 004 outcome — accepted 2026-11-09

| Criterion | Result | Evidence |
| --- | --- | --- |
| Root cause written down | Pass | plan.md: first frame written <~20 ms after open (post-enumeration) is corrupted → NoFrameStart; device then one reply behind → 5 s timeout. Also udev PermissionDenied race. |
| Connects after plug-in without user retry | Pass | QA reboot-sim 3/3 in app; hardware test 2 attempts/380 ms; human physical replug test OK |
| Retry after failure not broken by leftover state | Pass | each attempt uses a fresh port; drop-counter tests; no-settle hardware test recovers on attempt 4 |
| Bounded failure with clear message | Pass | silent/echo pty fail in 4.3–4.4 s with the existing message; 6 s deadline |
| UI shows backend connecting state only | Pass | QA saw Connecting… each time, no false Connected |
| Unit tests | Pass | lib.rs + session.rs scripted tests; `npm run check` green (PM ran it) |
| Real SA430 ≥10 cycles | Pass | 10/10 driver + 10/10 in-app, first try |
| ADR | Pass | ADR 0012 accepted (new direct dep `serialport`, already in tree) |

Human: "Works, accept + commit". QA's ad-hoc e2e spec (qa-004-connect) was dropped: it needed an out-of-repo reboot helper; hardware.rs covers the cases.
Notes (not 004): Center field 433.920000 MHz vs status bar 433.919 MHz (device step snapping, likely pre-existing).
