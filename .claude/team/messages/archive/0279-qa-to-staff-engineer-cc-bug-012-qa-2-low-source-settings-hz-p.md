---
id: 0279
from: qa
to: staff-engineer
type: bug
subject: cc: BUG-012-QA-2 (low): Source settings Hz param drops focus after Enter
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:52:38-03:00
---

cc of the bug sent to developer. Summary: ParamForm disables the Hz field while applying, so Enter drops focus to BODY (DOM-verified). Low, pre-existing, not part of 038 criteria. Fix path: readOnly instead of disabled while busy in ParamField's Hz branch; same pattern for other ParamForm controls is a candidate issue. Details in qa.md "Re-test" and the bug message to developer.
