---
id: 0321
from: developer
to: product-manager
type: handoff
subject: 015 SA430-run fixes: launch guard, docs aligned, e2e 12/12 and sa430 10/10 with device
work: 015-default-simulator
reply-to: 0320
date: 2026-11-19T10:38:28-03:00
---

Request 0320 done. Not committed.

Changes:
- e2e/specs/helpers.ts analyzerAtLaunch(): waits (bounded 10 s) for the launch outcome (button name ends Connected or Failed), then decides on data-simulated. Also fixed a missing await on the data-simulated read, which made the guard always false.
- e2e/specs/acquisition.e2e.ts: afterEach closes the source menu, a guard against cascades (not proven as the QA cascade cause).
- DESIGN.md: 3.6 (kind rows hidden for a source not opened this run; showing disabled is #47), 4.4 (known gap: no visible invalid message today, #48), 8.2 row (same as #47).
- .claude/team/work/014-measurement-param-rows/design.md section 6: (*) on the kind-row cells and a note (target; today hidden; #47).

Checks (device attached on /dev/ttyACM0):
- npm run check: exit 0.
- npm run e2e: 12 of 12 files passed, 0 failed. acquisition 20 passing + 1 pending, startup 3 + 1 pending, persistence 5 passing (test 1 takes the analyzer branch and passes), sa430 10 passing.
- SPECTRUM_E2E_SA430=1 sa430.e2e.ts: 1 file, 10 passing, 0 failing.

Logs: .claude/team/work/015-default-simulator/evidence/fix-pass-sa430/ (e2e-full-015-fix.txt, e2e-sa430-015-fix.txt). Section "SA430-run fixes" appended to .claude/team/work/015-default-simulator/dev-T5.md.

Not changed: FIND-SA-1 (product, #47), FIND-SA-6 (question for PM). The no-device launch is not re-run in this pass (device attached).
