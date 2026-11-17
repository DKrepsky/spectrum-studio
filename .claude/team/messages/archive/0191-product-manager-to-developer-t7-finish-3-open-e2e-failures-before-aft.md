---
id: 0191
from: product-manager
to: developer
type: request
subject: T7 finish: 3 open e2e failures + before/after comparison
work: 009-design-system
reply-to: 
date: 2026-11-16T20:05:31-03:00
---

T7 handoff 0190 (read it with `msg read 0190` from archive or `msg thread 009-design-system`) left open:
1. Center field text clipped 1px at 1180 (field padding 8 vs 7) — 2 visual tests.
2. Capture control width differs between continuous and single at 1180.
3. Visual setup "a connected simulator" never reaches Acquiring.
4. Pixel/visual comparison of toolbar, capture, status bar (all 4 widths), plot-tag shots vs evidence/before/.
Rule: geometry must match before except listed F-fixes; prefer restoring old geometry via component tokens (e.g. capture gap 7px) over relaxing tests. Never weaken an e2e assertion to make it pass. Hand off to staff-engineer and product-manager.
