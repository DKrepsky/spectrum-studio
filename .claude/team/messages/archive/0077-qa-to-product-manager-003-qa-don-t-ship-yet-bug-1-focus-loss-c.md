---
id: 0077
from: qa
to: product-manager
type: report
subject: 003 QA: don't ship yet (BUG-1 focus loss); check green; e2e red only on pre-existing hover guard
work: 003
reply-to: 
date: 2026-11-09T00:10:31-03:00
---

Verdict: DON'T SHIP yet. One major open bug: keyboard focus is dropped after every Play/Pause activation (BUG-1). Full matrix, screenshots and evidence: .claude/team/work/003-play-pause-button/qa.md

Checks
- npm run check: EXIT 0 (cargo 153 passed / 0 failed / 3 ignored; vitest 201 passed).
- npm run e2e: current tree rerun red only in visual.e2e.ts (hover tests 1180/1024/520 + known defect). Baseline HEAD also red there (1024/520 + known defect). Play/Pause specs (acquisition, failures, persistence, migration, sa430-skipped) pass. First full run had a one-off source-row failure that did not reproduce on rerun.

Criteria
- AC1 state pill gone, SIMULATED kept, state via source glyph/aria: PASS (screenshots/connected-1180-sim.png, evidence/screens-log.json).
- AC2 one icon-only button in the Run/Stop place: PASS (screenshots/connected-1180-sim.png, acquiring-1180-sim.png).
- AC3 Play starts; Pause only once backend reports acquiring: PASS (e2e + acquiring-1180-real.png on the real SA430).
- AC4 Pause freezes trace (HOLD), Play resumes: PASS (paused-1180-sim.png, paused-1024-sim.png, paused-1180-real.png).
- AC5 disabled when disconnected/remembered-not-connected; no auto-connect: PASS live (disconnected-1180-sim.png, dimmed); connecting/disconnecting only unit-tested.
- AC6 aria/title: PASS (attributes). Visible native tooltip not verified.
- AC6 focus ring, Space/Enter activation: PASS for the ring and for activation (qa-focus traces).
- AC6 focus kept after activation: FAIL (BUG-1, inherited from Run/Stop at HEAD, screenshots/focus-lost-after-keyboard-pause-1024-sim.png).
- AC6 square 30x30 = source button height, no layout shift: PASS (evidence/screens-log.json).
- AC7 unit + e2e updated, check green: PASS (gap: no keyboard/focus test).

Open bugs
- BUG-1 major: focus lost after keyboard Play/Pause (button disabled while busy).
- BUG-2 minor: status bar says "press Run to start acquisition."
- BUG-3 cosmetic: hovered Pause turns the Play teal (hover rule overrides .stop amber).
- BUG-4 minor, pre-existing: source menu actions overhang the badge column by 1 px; the visual hover test is flaky and red at HEAD.

Regression (visual.e2e hover test): reproducible, NOT caused by this change. Measured identical geometry at HEAD and working tree (source button 150x30, menu left 139.875, badge right 483.875, settled actions right 484.875). Root cause: source.css `.source-actions { right: 8px }` vs the badge sitting 9 px in (1 px border + 8 px padding). The 0.6 px tolerance passes only mid-transition, so 1180 is timing-flaky. HEAD also fails at 1024 and 520. Suggested fix in BUG-4 (right: 9px; wait for the transition in the test).

Residual risk: keyboard users lose their place after each Play/Pause until they Tab back. Tooltip and transitional states are verified by attributes/unit tests only.
