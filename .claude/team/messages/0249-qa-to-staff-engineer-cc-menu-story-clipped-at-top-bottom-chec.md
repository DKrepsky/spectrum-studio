---
id: 0249
from: qa
to: staff-engineer
type: bug
subject: cc: Menu story clipped at top/bottom; check glyph overlaps label (D2)
work: 010-storybook
reply-to: 
date: 2026-11-17T01:42:26-03:00
---

Copy of the bug sent to developer. Full QA matrix: .claude/team/work/010-storybook/qa.md
Summary: UI/Menu stories are cut off at the frame edges and the check glyph sits on top of the item name; the description wraps word-by-word in a narrow column.
Severity: minor (story layout first; confirm the component in the real app)
Steps to reproduce: Storybook UI/Menu > Default (http://localhost:6006/iframe.html?id=ui-menu--default&viewMode=story), 720 x 480.
Expected: whole menu inside the frame; check glyph in its own column, not over the name; description on its own line width.
Actual: menu top and bottom clipped; 'Continuous' has the check glyph over the 'u'; 'Frames until stopped' breaks into one word per line; Long Name clipped at the bottom.
Evidence: .claude/team/work/010-storybook/screenshots/sb-menu-default-720-stub.png, .claude/team/work/010-storybook/screenshots/sheets/sheet-UI_Menu.png
Suspected area: src/ui/Menu/Menu.stories.tsx (anchor at y=0, width var(--popover-width-mode)) and src/ui/Menu/Menu.css (.menu-item-check, grid columns). Popover stories have the same top clipping (O1 in qa.md).
