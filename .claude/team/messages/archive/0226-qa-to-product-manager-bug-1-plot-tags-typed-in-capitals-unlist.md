---
id: 0226
from: qa
to: product-manager
type: bug
subject: BUG-1 plot tags typed in capitals (unlisted visible change)
work: 009-design-system
reply-to: 
date: 2026-11-16T23:44:28-03:00
---

Summary: .ui-badge[data-variant='tag'] applies text-transform uppercase to the whole text: "HOLD · LAST DATA", "NO SOURCE CONNECTED". Not in F0-F17, C1 or decisions.md; DESIGN.md 8 and 2.8 say the caps style is for the state word and group labels.
Severity: minor
Steps to reproduce: visual spec state banner-device-lost-1440 or narrow-1024; or disconnect a source with the plot visible.
Expected: tag text in its set case; caps only for LIVE, CAPTURING, HOLD (DESIGN 2.8, 4 Badge tag).
Actual: whole tag in capitals.
Evidence: .claude/team/work/009-design-system/screenshots/compare-banner-device-lost-1440.png, screenshots/compare-narrow-1024.png; evidence/after-final/banner-device-lost-1440.png. Full report: .claude/team/work/009-design-system/qa.md (BUG-1).
Suspected area: src/ui/Badge/Badge.css ([data-variant='tag']).
