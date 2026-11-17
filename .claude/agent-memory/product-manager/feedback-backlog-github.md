---
name: feedback-backlog-github
description: Roadmap and backlog live only in GitHub issues (no roadmap file in the repo); issues use the story/bug templates
metadata:
  type: feedback
---

Rule: there is no roadmap in the repo (docs/roadmap.md was deleted 2026-11-17). All planned work, backlog and bugs are
GitHub issues in DKrepsky/spectrum-studio, written with the templates in `.github/ISSUE_TEMPLATE/`:
- user-story.md: # Story (As a / I want to / So I), # Context, # Resources, # Acceptance Criteria (Given/When/Then checkboxes)
- bug-report.md: # Description, # Steps to reproduce, # Expected behavior, # Evidence
No extra sections. Docs only link to the issues.

**Why:** after I opened 34 terse issues and kept a roadmap section pointing at them, the human said "that went terribly
wrong": the roadmap must live in GitHub issues and issues must follow their story/bug formats. The human also closes
issues that won't be implemented — don't reopen or recreate those.
**How to apply:** at the end of a work item, open follow-ups as properly formatted issues (check `gh issue list --state all`
first, including closed ones); reference issue numbers in outcome.md; never re-add roadmap/backlog lists to docs.
