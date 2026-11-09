---
id: 0076
from: qa
to: staff-engineer
type: bug
subject: BUG-4 (cc): Hover actions overhang badge column by 1 px (pre-existing)
work: 003
reply-to: 
date: 2026-11-09T00:10:24-03:00
---

Summary: Hover/focus actions overhang the badge column by 1 px, which makes the visual guard hover test flaky and red.
Severity: minor (pre-existing at HEAD; not caused by 003)
Steps to reproduce: Open the source menu at 1024 or 1180 px, hover the 60-char row, wait for the transition to end.
Expected: Actions sit on the badge column (right edge equal to the badge right edge).
Actual: Badge right 483.875, settled actions right 484.875 (source.css `.source-actions { right: 8px }` is measured from the row, but the badge sits 9 px in: 1 px item border + 8 px padding). The guard tolerance is 0.6 px, so it passes only while the 150 ms transform transition is still running.
Evidence: evidence/qa-measure-current.json and evidence/qa-measure-baseline.json (identical geometry at HEAD and working tree); evidence/qa-visual-baseline.log (HEAD fails 1024 and 520 too); evidence/qa-e2e-current-rerun.log (1180 fails on rerun).
Suspected area: src/styles/source.css (.source-actions) and e2e/specs/visual.e2e.ts (measures before the transition ends).
Suggested fix (not applied): `right: 9px` on .source-actions; in the test wait for the transition to finish before measuring the settled position. Do not widen TOL. The "hover actions sit below the badge pill" defect is separate.
Full QA: .claude/team/work/003-play-pause-button/qa.md
