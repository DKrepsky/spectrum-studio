---
id: 0071
from: qa
to: developer
type: bug
subject: BUG-2: Status bar copy still says Run
work: 003
reply-to: 
date: 2026-11-09T00:10:24-03:00
---

Summary: Status bar still tells the user to press Run, a control that no longer exists.
Severity: minor
Steps to reproduce: Select the Signal simulator (connect), no acquisition yet.
Expected: Copy refers to the Play control, or is neutral (e.g. "No data yet — press Play to start acquisition."), per the design wording.
Actual: "No data yet — press Run to start acquisition." (src/components/StatusBar.tsx:53).
Evidence: screenshots/connected-1180-sim.png and screenshots/connected-1180-real.png (bottom bar); evidence/screens-log.json status field.
Suspected area: src/components/StatusBar.tsx
Full QA: .claude/team/work/003-play-pause-button/qa.md
