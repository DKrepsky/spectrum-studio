---
id: 0073
from: qa
to: developer
type: bug
subject: BUG-3: Hovered Pause loses amber colour
work: 003
reply-to: 
date: 2026-11-09T00:10:24-03:00
---

Summary: Hovered Pause turns the Play colour; the amber Pause colour only shows when the pointer is away.
Severity: cosmetic
Steps to reproduce: Acquire (Pause shown), move the pointer over the Pause button.
Expected: Pause keeps its amber (warn) fill on hover, or a distinct hover shade of amber.
Actual: The fill becomes accent teal (`button.primary:hover:not(:disabled)` in src/styles/app.css overrides `button.primary.stop`), which matches Play. Computed amber rgb(255,181,71) only without hover.
Evidence: screenshots/acquiring-1180-sim.png (hovered, teal) vs screenshots/acquiring-nohover-1024-sim.png (amber).
Suspected area: src/styles/app.css (button.primary.stop rules). Suggested: add a `button.primary.stop:hover:not(:disabled)` rule with an amber hover shade.
Full QA: .claude/team/work/003-play-pause-button/qa.md
