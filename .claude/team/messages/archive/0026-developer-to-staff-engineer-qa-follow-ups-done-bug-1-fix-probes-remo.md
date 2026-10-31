---
id: 0026
from: developer
to: staff-engineer
type: handoff
subject: QA follow-ups done: BUG-1 fix, probes removed, backlog
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:58:09-03:00
---

npm run check: exit 0 (full).
1. BUG-1: SourceForm.tsx open-focus now = first empty required field, else first field, else Connect button. Root cause: optional fields sit behind "Show more", so such forms had no input. Two tests in SourceMenu.test.tsx (required field -> Host focused; optional-only driver -> Connect focused, never body); both press Escape and assert return to the list/Other list. Existing focus tests pass.
2. Deleted e2e/qa/ and e2e/logs/qa-menu-first-launch.png (untracked, only referenced by qa.md/archived messages, not docs).
3. docs/roadmap.md Known limitations: BUG-2, BUG-3, and the three not-hand-verified items. Version 99 finding: store.rs loads a newer-version sources.json silently, and the next change rewrites it as version 2 (commit_sources sets the version), dropping unknown fields. Recorded as a known limitation with follow-up. Not changed in code.
Nothing committed.
