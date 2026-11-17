---
id: 0228
from: qa
to: product-manager
type: bug
subject: BUG-2 popover row focus ring moved outside the row
work: 009-design-system
reply-to: 
date: 2026-11-16T23:44:28-03:00
---

Summary: keyboard focus on a source-popover row draws its 2px ring outside the row (before: inside). B1 says "looks the same"; not in decisions.md.
Severity: minor
Steps to reproduce: focus the source button, Enter, then ArrowDown or Tab.
Expected: ring as before, or a recorded ruling that moves it (DESIGN 5.1, 9.8).
Actual: ring outside the row box.
Evidence: .claude/team/work/009-design-system/screenshots/compare-menu-keyboard-focus-1440.png (top before, bottom after); evidence/qa-kb/kb-popover-tab.png. Full report: .claude/team/work/009-design-system/qa.md (BUG-2).
Suspected area: src/ui/Popover/Popover.css (row focus ring, outline offset).
