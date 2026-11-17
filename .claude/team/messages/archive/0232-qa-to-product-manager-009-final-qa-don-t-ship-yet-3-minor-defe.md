---
id: 0232
from: qa
to: product-manager
type: report
subject: 009 final QA: DON'T SHIP YET (3 minor defects, all small)
work: 009-design-system
reply-to: 
date: 2026-11-16T23:44:34-03:00
---

Verdict: DON'T SHIP YET. Gates are green; three minor items block a clean "as approved" ship.

Gates: npm run check EXIT 0 (cargo tests all ok; Vitest 52 files / 519 tests). Guard probe: boundary.test.ts and ESLint both fail on a forbidden import (probe removed). Visual guard: two full visual runs, 47 passing, 3 skipped, EXIT 0 each. Full npm run e2e: 10 of 11 spec files green; 1 red (visual "hover actions replace the badge", row actions did not appear) that is green when re-run alone (flake, not filed). Docs images re-shot (main-window, source-menu, edit-source; not committed).

AC: 1 pass; 2 FAIL for size and spacing literals (BUG-3), pass for colour/shadow/radius/z; 3 pass; 4 pass; 5 pass; 6 pass with ADR doc nit (section 5 still names legacy-controls, removed); 7 FAIL for two unlisted visible changes (BUG-1 plot tags caps, BUG-2 popover focus ring); 8 check pass, e2e 1 flake.

Open bugs: BUG-1 minor (plot tag caps), BUG-2 minor (popover focus ring outside row), BUG-3 minor (CSS size/spacing literals). Filed to you, cc staff-engineer.
Zoom (Q-5): Ctrl+= / Ctrl+- / Ctrl+0 do not zoom the webview (keys reach the page; no change). Unsupported, as recorded.
Keyboard walkthrough (popover, mode menu, dialog, chevron locked while acquiring): pass; focus rings visible.
Reduced motion: not run in a browser (static @media rules present).
Screenshot defect (QA tooling, not product): visual spec names shots by the width read before the resize settles; 28 to 51 of 88-93 shots disagree with their real width. Reviewers must use the PNG width. Not fixed by QA.
Residual risk: row-action reveal flake; reduced motion unverified; SA430 cases skipped (no device in the run).
Full report: .claude/team/work/009-design-system/qa.md
