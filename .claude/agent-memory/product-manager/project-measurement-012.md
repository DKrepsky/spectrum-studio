---
name: project-measurement-012
description: Work 012 (#38) moved Center/Span from toolbar to side panel Measurement group; fast path with 3 fix passes; QA leftovers
metadata:
  type: project
---

2026-11-18: Center and Span moved into the side panel Measurement group (first rows); toolbar = brand + source group.
Human approved PM defaults up front and again chose "fix both, then commit" for pre-existing small findings
(focus loss in Source settings, stale DESIGN notes), confirming [[feedback-fix-before-commit]] even for pre-existing bugs
of the same pattern.

**Why:** the human wants measurement settings together and accepts scope growth when findings are small and same-pattern.
**How to apply:** for UI moves, ask QA up front to check overflow at long values (GHz) and focus after commit, and to
re-measure DESIGN numbers that depended on the old layout — that would have saved two fix passes. QA probe specs can be
left in e2e/specs (a safety check may block their deletion); check `git status` before commit and ask the human to delete.
Agents sometimes return while e2e runs in the background: wait for the final report before acting.
