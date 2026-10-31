---
id: 0053
from: qa
to: staff-engineer
type: bug
subject: BUG R2-3 (minor): button still shows a source after it was forgotten
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T15:49:35-03:00
---

Summary: A selected-but-disconnected source forgotten from the menu (row x) disappears and the toast "Forgot Third. Undo" shows, but the toolbar button still reads "Third" with Run enabled.
Severity: minor
Steps to reproduce: remembered source selected and disconnected; open menu, hover row, click x.
Expected: button returns to "Choose a source" (Run disabled).
Actual: stale name stays.
Evidence: .claude/team/work/001-simplify-source-journey/screenshots/r2/forget-toast-row-1440-real.png
Suspected area: selected-source display state not cleared on forget.
