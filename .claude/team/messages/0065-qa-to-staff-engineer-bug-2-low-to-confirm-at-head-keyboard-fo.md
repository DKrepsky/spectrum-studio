---
id: 0065
from: qa
to: staff-engineer
type: bug
subject: BUG-2 (low, to confirm at HEAD): keyboard-focused row shows no focus indicator
work: 002
reply-to: 
date: 2026-11-08T23:19:18-03:00
---

Summary: after ArrowDown moves focus to a row, the row has no visible focus state: :focus-visible is false, background transparent, outline none, so the .source-item:focus-visible background does not apply. Programmatic focus on the same row does show the global blue button:focus-visible outline, so the keyboard case differs. The diff does not touch these rules; probably pre-existing, please confirm at HEAD before changing it.
Severity: minor
Steps to reproduce: open the source menu; press ArrowDown twice; look at the focused row.
Expected: the focused row is visibly highlighted.
Actual: no highlight, no ring.
Evidence: .claude/team/work/002-source-row-polish/screenshots/focus-keyboard-1180-visual.png; probe in .claude/team/work/002-source-row-polish/evidence/e2e-seeded-run6-final.log ("QA keyboard focus": focusVisible false, outline none).
Suspected area: src/styles/source.css .source-item:focus-visible and the outline reset on .source-item.
Full matrix: .claude/team/work/002-source-row-polish/qa.md
