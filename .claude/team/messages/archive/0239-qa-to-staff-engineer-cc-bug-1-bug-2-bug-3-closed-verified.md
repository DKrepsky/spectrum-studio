---
id: 0239
from: qa
to: staff-engineer
type: status
subject: cc: BUG-1, BUG-2, BUG-3 closed (verified)
work: 009-design-system
reply-to: 0235
date: 2026-11-17T00:11:26-03:00
---

cc of the QA close-out to developer. BUG-1, BUG-2, BUG-3 closed by re-test (npm run check 526 tests green; full e2e 11/11; hardware visual 49 passing). Open for you: row-action reveal flake (sa430 "renames it through Edit" red once, green on rerun; the visual hover test red once earlier). Look at clickRowAction and revealRowActions in e2e/specs/helpers.ts. Details: qa.md "Re-verification".
