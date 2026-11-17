---
id: 0198
from: designer
to: product-manager
type: handoff
subject: Ruling: row stays 44px, actions centred in the badge column
work: 009-design-system
reply-to: 0197
date: 2026-11-16T21:01:15-03:00
---

Ruling on row geometry (work 009, T9): keep 44px, actions centred in the badge column.

Measured (real CSS, headless Chrome, fallback fonts; 24px actions; harness: .claude/team/work/009-design-system/measure/row_geometry.py):
- Bottom-anchored under the badge (current T9 CSS): overlap with the badge pill 4.2px at 44px, 2.1px at 48px, 0.09px at 52px (touching; moves with the name's line box, so not robust).
- Centred in the 64px badge column at 44px: actions at 10 to 34px of the row, no overlap with line 2 or the badge once the badge fades (opacity 0 while shown). Row height unchanged.

Changes made:
- src/styles/tokens.css: --row-height 52px back to 44px (that line only).
- DESIGN.md: 2.10 row, 4.11 (row geometry, fixed-block ruling, why not 48/52), 9.9 (row action 24x24 measured, spacing exception not available: the select button's box lies under the actions), Appendix A (44px), new changelog 13.4.
- design.md: F2 row and a ruling note.
- Prototype already centres the actions (no change needed).

Fixed blocks (Signal simulator, Add source, Disconnect): no visible heading in 009, unchanged. DESIGN.md 4.11 says so. A visible label is Deferred.

Follow-up for the developer (not done by me; no production code touched except the token line):
- src/ui/Popover/Popover.css .list-row-actions: replace bottom: var(--space-1) with top: calc(50% - var(--target-min) / 2) and bottom: auto. Keep width, height, right.
- src/ui/Popover/ListRow.test.tsx: the test "bottom-anchored, never top-anchored" must change to "centred vertically in the badge column".
- e2e/specs/visual.e2e.ts: "hover actions sit below the badge pill" must change to: while the actions show, the badge opacity is 0 and the actions are inside the badge column and the row.

Decision for the human to review: "the actions never cover the badge" becomes "the actions replace the badge while shown; a visible badge is never covered".
