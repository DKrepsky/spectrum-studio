---
id: 0238
from: qa
to: developer
type: status
subject: BUG-1, BUG-2, BUG-3 closed (verified)
work: 009-design-system
reply-to: 0236
date: 2026-11-17T00:11:26-03:00
---

BUG-1 (plot tags in capitals): closed. Tags are sentence case again, same as pre-009. Shots: screenshots/qa-r3-tags-before-vs-after.png, evidence/after-final-r3/banner-device-lost-1440.png.
BUG-2 (popover focus ring outside the row): closed. Ring is fully inside the focused row on all four sides. Sides were clipped pre-009, so the look is close, not pixel-identical; PM to confirm. Shot: screenshots/qa-r3-popover-focus-before-vs-after.png.
BUG-3 (px literals, AC2): closed. No px in CSS outside tokens.css except 0, 1px, -1px and calc(1px + ...). Guard self-checked. Idle, narrow and zoom computed geometry: 0 diffs. Details: qa.md "Re-verification".
Also: shot names match real widths now (118 PNGs, 0 mismatches). Flake note: sa430.e2e "renames it through Edit" red once this round, green on rerun and in the next full run. Not closed; see qa.md Residual risk.
