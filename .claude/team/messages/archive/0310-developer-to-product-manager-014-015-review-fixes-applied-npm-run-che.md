---
id: 0310
from: developer
to: product-manager
type: handoff
subject: 014+015 review fixes applied; npm run check green; full e2e 10/12 spec files pass, migration-dup regression
work: 015-default-simulator
reply-to: 
date: 2026-11-19T03:09:13-03:00
---

Review fixes for 014+015 (request 0309) are in the uncommitted tree. No commit.

- Fix 1, S12: device rows read "Status unavailable" when start-up failed (`MeasurementPanel.tsx`, `unavailableReason`), with a test.
- Fix 2: `data-simulated="true"` on the source button only for a simulated live source (`SourceButton.tsx`), a test, and `analyzerAtLaunch()` now uses it (`e2e/specs/helpers.ts`).
- Note 1: `receiveStatus` reloads the list once per unknown live source identity (`session.ts`, store field `listReloadedFor`), with two tests.
- DESIGN.md 5.2.10 line updated for the S12 reason.

Checks:
- `npm run check`: exit 0 (803 Vitest tests).
- `npm run e2e` (full, extracted webkit2gtk-driver): 10 of 12 spec files pass. Touched by fix 2 and passing: acquisition 21, persistence 5, startup 4.
- sa430 spec: 10 pending. The SA430 is not attached here, so the attached run is NOT done.
- visual: 1 failing (hover-actions defect, known red on main), 46 passed, 3 pending.
- migration-dup: FAILING, 1 test. The launch fallback now remembers the simulator (015 tree), so the store has 2 records, not 1. Not fixed here; the owner should count the sa430 records or seed around it.

Details: .claude/team/work/015-default-simulator/dev-T5.md ("Review fixes"). Full log: /tmp/claude-1000/-home-kr-workspace-spectrum-kit/4c0a989e-67c9-4b64-9595-d4ba9bcd2b0d/scratchpad/e2e-full.log
