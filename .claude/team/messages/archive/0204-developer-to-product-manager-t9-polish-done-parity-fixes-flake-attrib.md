---
id: 0204
from: developer
to: product-manager
type: handoff
subject: T9 polish done: parity fixes, flake attribution, e2e green 6 runs
work: 009-design-system
reply-to: 0202
date: 2026-11-16T22:00:31-03:00
---

T9 polish done. Full report: .claude/team/work/009-design-system/t9-polish-report.md

(a) Row gap: 3px --row-gap, pitch 47 as before (measured). Row box stays 44 (ruling 0198); the old box was 47 and the rows touched, so the pitch matches, the box does not (the residual you can decide on).
(b) Badge centred on the row, both lines, as before (0.5px off centre, before 0.0px).
(c) "No new devices" note: text now at 16px from the popover edge, the same x as the heading text and the glyph column (before 17px, 4px right of the heading). Note padding 6px vertical, as before. Heading: 2px above and below, as before; F3 move of +3px applied (heading x 13 to 16).
Undo toast: 44px tall, as before (it was 30 after T9 finish, a 14px layout change I found in the crop and fixed).
Measured against HEAD: name x and glyph x identical (42, 16); popover height 457 vs 456; detected heading 2px higher (3px row box difference).

Crops (before left, after right): .claude/team/work/009-design-system/evidence/compare-T9/ typical-menu-1180, typical-menu-1024, undo-toast-1440, keyboard-focus-1440, hover-actions-1180, failed-row-1180 (each *-before-left-after-right.png). Shots: evidence/after-T9/ (118 PNGs, from the final full run).

Flakes (evidence in the report):
- source-row ArrowRight focus-within: PRE-EXISTING. HEAD worktree red in 5 of 7 source-row runs. Cause: the window had no OS focus (document.hasFocus false), so :focus-within does not match. Fixed the test: raises the window when needed, waits for the reveal.
- stale element (edit-source, migration-dup): PRE-EXISTING pattern (HEAD edit-source 1 of 3 runs). Fixed at the pattern: all reverse existence waits now run in the page (waitForGone).
- Open watch item: 4 of about 12 standalone source-row runs (after the window raise was added) had the popover close during the focus test, and the next tests cascaded. Not root-caused; zero in the 6 full runs.

e2e: full npm run e2e green 6 of 6 runs on the final code families (B to G; 11/11 spec files). npm run check EXIT 0 (504 tests).

Docs: DESIGN.md 2.10 (--row-gap row, Appendix A matched), 4.11 pitch sentence; docs/testing.md wmctrl prerequisite. docs/roadmap.md line 40 is still yours (the hover-actions defect is resolved by T9).
