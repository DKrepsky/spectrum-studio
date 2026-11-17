---
id: 0211
from: developer
to: product-manager
type: handoff
subject: T10 visual review: before/after dialog states, differences and intent
work: 009-design-system
reply-to: 0207
date: 2026-11-16T22:38:38-03:00
---

T10 (Add/Edit source dialog) is on the ui components. Checks: `npm run check` green; `npm run e2e` 11/11 spec files green. Shots: evidence/before-T10 (pre-T10 build) and evidence/after-T10 (final build); crops evidence/compare-T10/<state>-<width>-before-left-after-right.png (script make_crops.py; zoom-labels-1180-filled-before-top-after-bottom.png for the label check).

Coverage: 1180px full set (empty, filled, invalid, Test OK, testing, test failed, long name + long port, Save busy (add), save error, Edit idle, Edit busy Save, Edit locked). 1024px: empty, filled, invalid, Test OK, testing, failed, long, Save busy. Not captured at 1024: save error and the Edit states (probe timeout, same in both builds).

Visible differences, after the two fixes I made during review (dialog param frame and muted labels restored; both were unintended):
Intended, from the list:
- F7 field labels 12 to 13px ("Name", "Driver", "Serial port"). Intended.
- F6 help text 11 to 12px ("Only sources that need...", "Path of the device's serial port..."). Intended.
- F8 inline error 12px (name duplicate, owner note). Same size as before in the crops; the save error is now 12px too. Intended (no visible change).
- F9 unavailable 0.45 to 0.6: Test connection when idle (no port), Cancel/Forget while saving, Forget while busy. Slightly brighter. Intended.
- F15 field boundary lighter (name, serial port, driver select): visible on every state. Intended.
- T5b busy: Test connection shows a spinner over its masked label while testing (no width change); Save shows a spinner while saving (no width change). Intended. Note: the testing button is no longer dimmed (aria-disabled, not disabled), so it reads as active with a spinner.
- B2 wording/roles only (no visible change): errors and notes are polite.
- Warn note (owner) still amber with the warning glyph, as before.
Not intended, found and restored during review:
- Param field frame (a bordered box around "Serial port" from the side panel's ParamForm group): removed. Restored to no frame.
- Label colour: stacked ui labels are primary; the dialog labels are muted again as before (dialog layout otherwise matches).
- Vertical spacing between the driver hint and the serial port field: restored to the before spacing (4px between the parameter block and its hint).
Nothing else differs on the before/after crops at 1180 or 1024 (buttons, footer order, result box height, locked fields at 0.75, notes, long name clipping).

Open for you:
- Save while saving stays native-disabled (focus can drop in WebKit); Test is busy/aria-disabled. Tell me if Save should be unavailable instead.
- Dialog labels muted vs the ui stacked default (primary). I kept muted to match the before look; if primary is the intended dialog look, it's a DESIGN decision and a one-line change.
- Error/notes use role=status when inserted (per spec); strict 9.6 would need an always-mounted container.

Docs: no docs changed (T12 owns DESIGN.md 3.8 and 4.12 wording; the dialog padding is now the --dialog-offset-top/--dialog-padding-inline tokens).
