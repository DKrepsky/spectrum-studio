---
name: project-storybook
description: Work 010 Storybook accepted 2026-11-17 — real Storybook chosen over lighter tools; stories + axe guarded in npm test
metadata:
  type: project
---

Work 010 (issue #36, committed 2026-11-17): Storybook 10 + addon-a11y, dev-only (ADR 0016). Every src/ui component
needs a stories file; every story renders and passes axe inside `npm test`, so new components ship with stories.

**Why:** the human wanted to browse components in isolation; chose full Storybook over Ladle/in-house gallery despite
the dependency weight, and wanted the a11y addon in, not deferred.
**How to apply:** new src/ui components need stories + clean axe; design questions found via stories (Badge truncation,
Menu icon column) were decided by PM and written into DESIGN.md. Skipping the designer for tooling work was fine.
Related: [[project-design-system]], [[feedback-fix-before-commit]].
