---
id: 0203
from: developer
to: staff-engineer
type: handoff
subject: T9 polish done: row gap, badge centred, note aligned, stale and focus flakes attributed
work: 009-design-system
reply-to: 0202
date: 2026-11-16T22:00:31-03:00
---

T9 polish (0202) done, uncommitted. Full report with numbers and evidence: .claude/team/work/009-design-system/t9-polish-report.md

Changed: src/styles/tokens.css + DESIGN.md 2.10 and Appendix A (--row-gap 3px); src/ui/Popover/Popover.css (row gap, heading 2px above and below, note inset and 6px vertical); src/styles/source.css (badge spans both lines and is centred, toast 44px); src/components/source/SourceMenu.tsx (notes in .popover-note); DESIGN.md 4.11 pitch sentence; tests: ListRow.test.tsx, source.css.test.ts; e2e: source-row.e2e.ts (badge centred on the row, pitch test, focus test waits for the reveal), helpers.ts (waitForGone, ensureWindowFocus), 24 reverse waits moved to waitForGone in 9 spec files; docs/testing.md (wmctrl).

Checks: npm run check EXIT 0 (51 files, 504 tests). Full npm run e2e: green in 6 runs (B to G, 11/11 spec files); E wrote evidence/after-T9.

Flakes: ArrowRight focus-within red is pre-existing (HEAD worktree 5 of 7 source-row runs red; cause: no OS window focus, hasFocus false). Stale element on reverse waits is pre-existing (HEAD edit-source 1 of 3); fixed at the pattern. Open watch item: in 4 of about 12 standalone source-row runs after the wmctrl change, the popover closed during the focus test and the next tests cascaded; not root-caused; none in the 6 full runs.

Ask: decide the residuals in the report (row box 44 vs old 47 box; detected heading 2px higher) and whether the cascade watch item is acceptable.
