---
name: feedback-fix-before-commit
description: Small defects/follow-ups found during a work item get fixed before commit, not deferred to issues
metadata:
  type: feedback
---

When QA/review surfaces small follow-ups inside a work item, the human prefers fixing them in the same change before
committing rather than opening issues for later.

**Why:** at work 010 (Storybook) acceptance I offered three follow-up issues (Badge long text, icon-less menu item,
a11y addon); the human answered "fix these issues before committing".
**How to apply:** at acceptance, offer "fix now" as the default for small, in-scope findings; reserve issues for
large or genuinely separate work. See [[feedback-backlog-github]].
