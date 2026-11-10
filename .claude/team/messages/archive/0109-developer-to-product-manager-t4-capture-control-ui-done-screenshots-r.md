---
id: 0109
from: developer
to: product-manager
type: handoff
subject: T4 capture control UI done: screenshots ready for review
work: 006-capture-modes
reply-to: 0106
date: 2026-11-09T21:39:35-03:00
---

T4 is implemented (uncommitted) and `npm run check` is green. Screenshots of the real React toolbar (Chrome, stubbed backend IPC, not the Tauri binary) are in .claude/team/work/006-capture-modes/screenshots/dev-*.png: 1440 continuous idle, single idle, single capturing (Stop square, CAPTURING), menu open, disabled with no source, focus ring on the whole control; 1024 continuous acquiring (Pause, no amber), single capturing with a long name (ellipsis), menu open.

Done per design: teal Continuous / purple Single split button with 128 px label and 26 px chevron, Pause no longer amber, SIMULATED badge removed, menu with arrows/Enter/Esc/Tab, locked chevron while acquiring, live region for single complete/cancelled/failed.

Still open: the e2e specs (T5) still reference the removed SIMULATED badge and the old aria labels, so they will fail until T5 lands. WebKitGTK font width at 1024 (Q8) is not verified yet. Details are in the handoff to staff-engineer.
