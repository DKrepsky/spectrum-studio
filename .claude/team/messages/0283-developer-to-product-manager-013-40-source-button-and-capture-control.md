---
id: 0283
from: developer
to: product-manager
type: handoff
subject: 013 (#40) source button and capture control in the Measurement group: implemented
work: 013-measurement-source-capture
reply-to: 
date: 2026-11-18T02:39:27-03:00
---

Implemented, not committed (branch feat/40-measurement-source-capture). Notes: .claude/team/work/013-measurement-source-capture/dev.md

What changed
- Toolbar: brand only. SourceButton first and CaptureControl last in MeasurementPanel (full width; SplitButton `fullWidth`).
- Popover width in the panel = the source button width (305px). The side panel is a scroll box and clips a 360px popover; capture menu (280px) is right-aligned and fits.
- Tokens removed: --source-name-min/max, --toolbar-gap, --toolbar-group-gap (Appendix A equal).
- DESIGN.md updated (2.10, App. A, 3.1, 3.2, 3.3, 3.6, 3.7, 3.9 marked pre-040, 4.3, 4.11, 5.9, 9.8, 9.9, Q-5, Q-6). docs/user-guide, architecture, testing updated.

Checks
- npm run check: EXIT 0 (Vitest 55 files, 710 tests).
- visual.e2e: 47 passing. acquisition.e2e: 19 passing (new test: popovers fully inside window and panel, Escape returns focus).
- Full npm run e2e: 8 of 11 specs passed. failures.e2e fails 1 test (SA430 "busy" text) and migration failed once: /dev/ttyACM0 is held by another running spectrum-studio (PID 70673). migration passes 3/3 alone; failures passes 2/3 alone. Not a regression I can show; not verified on HEAD.

Points for you / the designer
- The capture control is now at the bottom of a scrolling panel: when the user scrolls to Source settings it is out of view (state still shows in the plot tag and status bar).
- Zoom (Q-5) not re-measured for the side panel; 3.9 rows are marked as measured before 040.
- Span focus and O1 notes from 012 unchanged.
