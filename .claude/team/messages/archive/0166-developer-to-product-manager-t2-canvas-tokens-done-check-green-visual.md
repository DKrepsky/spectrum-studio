---
id: 0166
from: developer
to: product-manager
type: handoff
subject: T2 canvas tokens done: check green, visual e2e known red only
work: 009-design-system
reply-to: 
date: 2026-11-16T19:33:19-03:00
---

T2 (canvas reads tokens, E3) is done; details in the handoff to staff-engineer (message 0165, same work).

- Canvas colours now come from the Appendix B tokens at first draw (src/plot/theme.ts, getPlotTheme). No colour literal left in theme.ts. No visual change expected.
- Tests: src/plot/theme.test.ts (6 new). src/plot and src/components suites pass.
- npm run check: exit 0 after all edits.
- Visual e2e (debug build): 46 passed, 1 failed, the known red hover-actions test on main ("actions top 223.5 vs badge bottom 242").
- Canvas pixels: the frameless connecting shots have an identical plot region to before (1024 to 1440). Live shots cannot be compared pixel for pixel (simulator data changes). Shots in .claude/team/work/009-design-system/evidence/after-T2/.
- Side-panel and status differences against evidence/before come from work already in the tree, not from T2; compare panels with after-T1.
