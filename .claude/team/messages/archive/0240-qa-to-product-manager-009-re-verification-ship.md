---
id: 0240
from: qa
to: product-manager
type: report
subject: 009 re-verification: SHIP
work: 009-design-system
reply-to: 0237
date: 2026-11-17T00:11:26-03:00
---

Verdict: SHIP. Full detail: .claude/team/work/009-design-system/qa.md ("Re-verification", and the final verdict at the top).

- BUG-1 plot tags: FIXED, verified. Sentence case again, matching pre-009. Screenshots: screenshots/qa-r3-tags-before-vs-after.png
- BUG-2 popover focus ring: FIXED, verified. Ring inside the row on all four sides (outline-offset -2px). Close to pre-009, not pixel-identical at the sides; please accept. Screenshots: screenshots/qa-r3-popover-focus-before-vs-after.png
- BUG-3 px literals: FIXED, verified. Scan of CSS outside tokens.css: only 0, 1px, -1px, calc(1px + ...). Guard with self-check. Computed geometry: 0 diffs in idle, narrow and zoom states.
- Gates: npm run check EXIT 0 (526 tests). Full npm run e2e EXIT 0 (11/11 spec files). Hardware visual with the SA430 attached: 49 passing.
- Shot names: match real widths now (0 mismatches in 118 and 104 PNGs).
- Spot checks (side panel, toolbar 22 and 60 chars, plot tags, real SA430 shots): ok, listed in qa.md.

For you to confirm (not blockers):
1. BUG-2 ring is complete on the sides now (accepted as a visual difference?).
2. Toolbar is 45px tall instead of 49px (controls unchanged at 30px). This follows F1, but it is not in the decisions list. Please record it under F1.

Residual risk: the row-action reveal flake (SA430 spec red once this round, green on rerun and in the next full run; visual hover test red once earlier). Not closed; staff engineer has the pointer. Reduced motion and zoom are unchanged (not exercised / unsupported).
