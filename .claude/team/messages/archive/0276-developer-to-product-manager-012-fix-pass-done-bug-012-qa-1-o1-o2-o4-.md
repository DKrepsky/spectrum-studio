---
id: 0276
from: developer
to: product-manager
type: request
subject: 012 fix pass done: BUG-012-QA-1, O1, O2, O4, DESIGN 3.2/9.9
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:36:27-03:00
---

Fix pass for 012 (issue 38) is done, uncommitted on feat/38-measurement-center-span. Notes: .claude/team/work/012-measurement-center-span/dev.md (section "Fix pass").

Fixed:
- BUG-012-QA-1: side panel inline control column 130px to 140px (--field-width-inline, tokens.css, DESIGN 2.10 and Appendix A). Center, Span and FFT size are all 140 x 28 at 1440 and 1024; 5.999000000 GHz no longer clips (scrollWidth 138 = clientWidth 138).
- O1: Enter keeps focus in Center. Blur removed; while applying, Center is read-only, not disabled (a disabled control drops focus in WebKit). Span still disables while applying and has the same focus loss on pick: separate candidate, not fixed.
- O2: no source shows an em dash for Center, not 0 Hz.
- O4: visual guard sets 5999M, checks the GHz value fits (scrollWidth <= clientWidth), restores 100M. Screenshot checked at 1024.
- DESIGN 3.2 spare widths (889.5 / 834.1 at 1440, 492.5 / 437.1 at 1024) and 9.9 targets (140 x 28 each, measured after the fix) filled in; re-measure markers removed.

Checks: npm run check EXIT 0 (Vitest 55 files, 696 tests; cargo; ESLint; tsc). acquisition.e2e.ts 16 passing; visual.e2e.ts 47 passing. Probe spec deleted.

Candidates for issues (not opened by me): O1 for the Span select; DESIGN 3.9 row about the 150% zoom still says "Toolbar broken today" (Center moved out, needs a fresh measurement).
