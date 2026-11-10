---
id: 0121
from: qa
to: product-manager
type: report
subject: QA report 006: don't ship yet (BUG-1 open; visual e2e failures need a decision)
work: 006-capture-modes
reply-to: 
date: 2026-11-09T22:17:43-03:00
---

Verdict: DON'T SHIP YET. One open medium defect (BUG-1, cancel on SA430). Everything else in 006 passes in the real app. Details: `.claude/team/work/006-capture-modes/qa.md`.

Gates
- npm run check: PASS (exit 0; 183 Rust, Vitest 247/247, lint, tsc, prettier).
- npm run e2e: EXIT 1 only from visual.e2e.ts (19 pass / 4 fail). The 4 are the same as on HEAD: hover-under-badge (known) and three "source button never showed Bench SA430 analyzer 2" (failing pick in the source menu, code not changed here). Other specs pass; source-row passed here (flaky for the developer).
- SA430 e2e with the device attached: 6/6 PASS.
- QA tour (real SA430 + simulator, both widths): 6 of 7 pass; the failing check is BUG-1.

Per criterion (story.md)
- AC1 control and menu: PASS (screenshots).
- AC2 colours and contrast: PASS (label ratios 10.21 / 6.31 / 4.95 hover, from tokens).
- AC3 continuous like today: PASS.
- AC4 single one sweep, auto-stop, again, cancel: PASS on simulator and on SA430 sweep/auto-stop; cancel on SA430 OPEN (BUG-1).
- AC5 backend auto-stop, no UI timer: PASS.
- AC6 default Continuous, remembered, validated: PASS (restart screenshot; store tests).
- AC7 locked while acquiring, disabled while disconnected: PASS. Busy state NOT RUN (too brief in the real app).
- AC8 averaging = one raw sweep: PASS (simulator Avg 1/4; SA430 Avg 1/4 in an earlier run).
- AC9 SIMULATED badge gone: PASS (no badge in any screenshot; name in source button).
- AC10 keyboard, names, focus ring, no layout shift: PASS (keyboard run, focus screenshots, identical geometry at 1440 and 1024).
- AC11 tests, check, screenshots: PASS except the BUG-1 check.

Width (WebKitGTK, real fonts): capture control 154 x 30 in every state; toolbar overflow 0 at 1024 with the real SA430 name (224.6 px, not cut) and with the 60-char name (280 px, ellipsis).

Visual: all 32 QA screenshots opened and checked; no visual defect caused by 006.

Open for you
1. BUG-1 (medium). Staff engineer to say whether it is a discard bug or a late cancel. Until then, don't ship.
2. visual.e2e.ts 4 failures (pre-existing): fix or mark skipped with a reason. I recommend tracking them as a separate item; they do not come from 006.
3. QA-only spec e2e/specs/qa-capture-tour.e2e.ts and seed e2e/fixtures/seed/qa-capture-tour/ are uncommitted; keep or drop.

Residual risk: the busy state and the capture-failed/device-lost notices are covered by unit and Rust tests only; tooltips and live-region text not read in the real app; hardware add-source and visual hardware cases not run.

Nothing committed.
