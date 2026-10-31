---
id: 0050
from: qa
to: product-manager
type: bug
subject: BUG R2-2: 60-char name at 1024 makes toolbar and side panel wider than the window
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T15:49:35-03:00
---

Summary: With a 60-character source name the source button grows to its 280px max and the layout becomes ~39px wider than a 1024px window: "Export CSV" is cut at the right edge and the right panel (dropdowns, "traces", "dB") is cropped. A 22-char name fits; 1180 is fine. The visual guard missed it (it checks scrollWidth; the overflow is clipped, not scrollable).
Severity: major (human criterion 3 names the 60-char name at the window minimum)
Steps to reproduce: Edit the USB source, name "bcdefghij klmnopqrs tuvwxyz 0123456789 ABCDEFGHIJ KLMNOPQRST", Save; 1024px window, disconnected and acquiring.
Expected: toolbar fits at 1024 (button shrinks / lower max).
Actual: measured toolbar width 1063, side panel x=733..1063 in a 1024 window while acquiring; disconnected screenshot shows the same cropping.
Evidence: .claude/team/work/001-simplify-source-journey/screenshots/r2/button-name60-1024-real.png (disconnected), .claude/team/work/001-simplify-source-journey/screenshots/r2/toolbar-acquiring-name60-1024-real.png (acquiring; capture includes a stale resize frame, overrun still visible), .claude/team/work/001-simplify-source-journey/screenshots/r2/menu-hover-name60-1024-real.png ; contrast .claude/team/work/001-simplify-source-journey/screenshots/r2/button-name22-1024-real.png fits. Log r2f.log.
Suspected area: .toolbar min content width vs source-button max-width 280px.
