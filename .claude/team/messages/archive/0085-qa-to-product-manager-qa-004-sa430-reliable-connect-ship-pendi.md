---
id: 0085
from: qa
to: product-manager
type: report
subject: QA 004 SA430 reliable connect: ship, pending human replug test
work: 004-sa430-reliable-connect
reply-to: 
date: 2026-11-09T18:51:48-03:00
---

Verdict: SHIP, with one human test still open (physical replug, criterion 4). No defects found; no bug messages filed.

Evidence (details and screenshot paths in .claude/team/work/004-sa430-reliable-connect/qa.md):
- npm run check: exit 0 (Rust 166 passed, 0 failed; Vitest 204 passed).
- Hardware suite, app closed: 6/6 passed on the real SA430. 10 driver cycles, all first attempt (~229 ms each).
- Real app (debug build, WebDriver): 10/10 connect-acquire-disconnect cycles from the source menu, first try. Click-to-Connected 331-538 ms. Every cycle showed live dBm (never Uncalibrated). Screenshots: screenshots/qa-connected-1440-real-cycle1.png and -cycle10.png, both ok.
- Plug-in simulation (device reset with Sa430::reboot from a scratch helper, outside the repo; port back after ~665 ms): 3/3 connected from the menu with no user retry, no false Connected. Connecting... shown during each connect.
- Negative: silent pty 4.4 s and echoing pty 4.3 s both fail with the "did not answer like an SA430 ... Unplug and reconnect" message (screenshots ok). Missing /dev/ttyACM9 fails in 1.1 s with the open-error text (intended; my test expectation was wrong, not the product).
- Regression: simulator connects and acquires (dBFS label). SA430 sweeps for 60 s, 12 samples, no timeout or notice, steady ~9 fps. Screenshot qa-soak-1440-real-after60s.png ok.

Not done / caveats:
- Physical replug: QA cannot replug. Human test needed: unplug, wait, plug in, pick the SA430 once; expect first-try connect. Repeat 3x if possible.
- Retry UI path (Connecting during retries) is only covered at driver level; the app never needed a retry in these runs.
- Minor, not 004: Center field shows 433.920000 MHz while the status bar shows 433.919 MHz (device step snapping, likely pre-existing). Failure text keeps the raw cause "(I/O error: Operation timed out)", same style as before.

QA test spec (untracked, gated by env vars, not product code): e2e/specs/qa-004-connect.e2e.ts. Logs: e2e/logs/qa-004/. Nothing committed.
