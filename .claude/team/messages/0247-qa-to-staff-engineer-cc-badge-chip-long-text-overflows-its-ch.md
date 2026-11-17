---
id: 0247
from: qa
to: staff-engineer
type: bug
subject: cc: Badge chip long text overflows its chip (D1)
work: 010-storybook
reply-to: 
date: 2026-11-17T01:42:26-03:00
---

Copy of the bug sent to developer. Full QA matrix: .claude/team/work/010-storybook/qa.md
Summary: Badge chip text overflows the pill; nothing truncates it.
Severity: minor
Steps to reproduce: Storybook UI/Badge > Chip Long Text (http://localhost:6006/iframe.html?id=ui-badge--chip-long-text&viewMode=story), 720 px wide.
Expected: ellipsis with full name in title/aria, or wrap inside the chip; nothing outside its container.
Actual: .ui-badge width 140 px, scrollWidth 321 px, white-space nowrap, overflow visible; text runs out past the pill.
Evidence: .claude/team/work/010-storybook/screenshots/sb-badge-chip-long-text-720-stub.png, .claude/team/work/010-storybook/screenshots/sb-badge-chip-long-text-720-zoom.png
Suspected area: src/ui/Badge/Badge.css (nowrap with no overflow handling) and/or the story width.
