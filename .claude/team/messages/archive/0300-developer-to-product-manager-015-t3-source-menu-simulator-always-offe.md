---
id: 0300
from: developer
to: product-manager
type: handoff
subject: 015 T3 source menu: simulator always offered, Disconnected line, refresh on open
work: 015-default-simulator
reply-to: 
date: 2026-11-19T02:01:52-03:00
---

015 T3 (#46) done, uncommitted. Files: src/state/sourceEntries.ts (simulatorEntry, unnamed simulator hidden from Your sources, fixed row always), src/components/source/SourceMenu.tsx (fixed row current/status/two-line when current, "Disconnected" word via stateWord, refresh on open, pick connects the remembered unnamed entry), plus tests in sourceEntries.test.ts and SourceMenu.test.tsx. Report: .claude/team/work/015-default-simulator/dev-T3.md.
Checks: vitest source+state 189 passed; whole vitest 746 passed; eslint and prettier clean on changed files; tsc has no errors in my files (others' 014 T1 / 015 T1 half-done edits still error elsewhere). Not run: npm run check as a whole, e2e. Visual check at 1024 of the two-line simulator row still open for QA.
Note for T2: simulatorEntry is exported from src/state/sourceEntries.ts, ready to import.
