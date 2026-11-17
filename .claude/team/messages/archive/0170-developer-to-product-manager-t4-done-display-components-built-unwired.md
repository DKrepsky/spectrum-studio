---
id: 0170
from: developer
to: product-manager
type: handoff
subject: T4 done: display components built, unwired
work: 009-design-system
reply-to: 0163
date: 2026-11-16T19:34:58-03:00
---

T4 is built: Badge, StatusDot, Banner (with BannerRegion), LiveRegion, Section, Table, StatusStrip under src/ui/. Not wired into any screen yet, so no visible change.
Behaviour the spec asks for is covered by tests: banner roles follow urgency; BannerRegion stays mounted; StatusStrip drops whole items lowest dropOrder first, never drops pinned items, and re-measures on resize and item change; the Section is a native details.
Open points for you: the status bar's halo ring uses an outline because DESIGN.md has no ring token (flagged to staff engineer); the Banner dismiss is an inline 24px button until T3's IconButton lands (T11 switches it).
Full report: .claude/team/work/009-design-system/evidence-t4-developer-report.md
