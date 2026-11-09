---
id: 0079
from: qa
to: product-manager
type: report
subject: 003 QA round 2: SHIP (BUG-1..4 verified fixed)
work: 003
reply-to: 
date: 2026-11-09T00:25:58-03:00
---

Verdict: SHIP.

Round 2 retest of the working tree (no production code changed, no commit). Full detail, per-item verdicts and screenshot paths: .claude/team/work/003-play-pause-button/qa.md, section "Round 2".

- npm run check: EXIT 0. cargo tests all pass; vitest 204 passed.
- npm run e2e: 9 of 10 spec files pass (incl. new keyboard-focus spec). visual.e2e: 21 pass, 1 fail = the known defect "hover actions sit below the badge pill", failing only on its own assertion (actions top 176.5 vs badge bottom 195). No other failure.
- BUG-1 (focus) fixed: Tab reaches Play with a blue 2px ring; repeated Space/Enter keeps focus on Play at 1180 and 1024.
- BUG-2 (copy) fixed: "No data yet — press Play to start acquisition." at 1180 and 1024, simulator and real SA430.
- BUG-3 (hover) fixed: hovered Pause rgb(240,162,46) amber; hovered Play teal rgb(43,199,158); disabled Play has no hover change.
- BUG-4 (overhang) fixed: menu hover actions left/right exactly equal the badge column (419.875/483.875) at 1180 and 1024; screenshots r2-menu-hover-*.
- AC1-AC5 regression pass OK on simulator and real SA430 (AC4: real frame counter frozen at #15 over 3 s after Pause).

Caveat: the double-press "no second start" was not counted via IPC (my spy missed the call path); the state sequence and unit test support it.
Observation (not a blocker): one ~0.7 s frame tail after Pause on the real device, then frozen. Native tooltips still not captured in screenshots.
Open bugs: none from round 1. Known defect unchanged.
Temporary probe specs and seeds removed; e2e tree clean.
