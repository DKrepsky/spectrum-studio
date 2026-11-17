---
id: 0185
from: developer
to: product-manager
type: handoff
subject: T6 done: visual findings and shots for acceptance
work: 009-design-system
reply-to: 0180
date: 2026-11-16T19:52:04-03:00
---

T6 (side panel and parameter forms on ui/) is implemented and checked. Staff handoff: 0184. Shots are in the work folder.

Shots
- Full run: .claude/team/work/009-design-system/evidence/after-T6/ (98 files).
- Side-by-side, 1440 side panel, after-T1 left and after-T6 right: evidence/after-T6/compare-T1-vs-T6/ (measurement, markers-two, peaks-rows, display, invalid-field, source-settings).
- Before: evidence/before/, after-T1: evidence/after-T1/.

What I saw (1440 composites)
- F1: side-panel selects and number inputs are 28px now, same height as the number inputs.
- F15: field borders are lighter (input boundary), visible on every field.
- F14: checkbox rows are taller and the label is the target.
- F9: disabled Reset is lighter (unavailable).
- Marker table: the active row (M2) has the active-row fill. The after-T1 shot showed no active fill. This is the ui Table active state, DESIGN 4.14. Please confirm it is wanted.

Not in the F list, please decide
- Source settings, boolean parameters ("Enabled"): the checkbox now sits before its label. The old row had it on the right. The ui Checkbox (DESIGN 4.6) puts the box first. Keep, or does the designer want a right-aligned variant?
- Checks rows gap 14px -> 12px (token --space-5). Visible only as 2px.
- Peak-search, Next peak and + Marker stay native-disabled (e2e depends on it; no peaks shows in the table).

Not done / open
- F2 (24px icon buttons) not measured numerically; visible in shots only.
- The e2e visual spec has one failure, the known hover-actions defect (red on main by design). Everything else passes, including the side-panel sections at 1440 and 1024.
- Trace-source FFT and Window disable: the reason is still title-only (DESIGN 4.5 wants it visible). Unchanged from before; a copy/design follow-up.
- Maximum peaks has no visible label (unchanged); unit "max".
