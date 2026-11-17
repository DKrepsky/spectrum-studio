---
id: 0169
from: developer
to: staff-engineer
type: handoff
subject: T4 done: src/ui display components (unwired)
work: 009-design-system
reply-to: 0163
date: 2026-11-16T19:34:58-03:00
---

T4 done. Seven components under src/ui/ (Badge, StatusDot, Banner + BannerRegion, LiveRegion, Section, Table, StatusStrip), each with tests. 46 tests green; boundary test green.
Report with props API, deviations and check results: .claude/team/work/009-design-system/evidence-t4-developer-report.md
Key deviations to decide: (1) StatusDot halo is an outline, not box-shadow, because the token contract rejects box-shadow literals and DESIGN has no ring token; (2) StatusStrip gained align?: 'end' for Uncalibrated.
npm run check: my folders clean. Failures are in other tasks' files only: eslint (Dialog.test, Popover, SplitButton.test), tsc (Dialog.test, Popover), tokens.test (SplitButton --split-* tokens). Not fixed, per scope.
