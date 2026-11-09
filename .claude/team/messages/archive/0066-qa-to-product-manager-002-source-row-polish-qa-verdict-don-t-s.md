---
id: 0066
from: qa
to: product-manager
type: report
subject: 002 source row polish: QA verdict DON'T SHIP YET (one keyboard regression)
work: 002
reply-to: 
date: 2026-11-08T23:19:18-03:00
---

Verdict: don't ship yet. Everything except the keyboard arrow route is verified in the real app (WebKitGTK, real SA430 attached). Fix BUG-1, then I re-test.

Per criterion (details, evidence and the matrix are in .claude/team/work/002-source-row-polish/qa.md):
- AC1 badge centred, two-line and single-line: PASS (measured within 0.5px; screenshots hover-two-line, rest-two-line)
- AC2 buttons hidden on open, incl. keyboard-focused row: PASS (menu-open-1180-visual.png, focus-keyboard-1180-visual.png)
- AC3 hover reveal ~150ms slide from left, leave hides: PASS (transition 0.15s, transform from -6px; the slide is 6px. Mid-frame not captured.)
- AC4 buttons centred, aligned, in the tag column, no overlap: PASS (hover-two-line, hover-long screenshots)
- AC5 reduced motion: NOT RUN. WebKitGTK does not report prefers-reduced-motion even with GNOME animations off, so the app cannot show it here. Covered only by the CSS string test.
- AC6 keyboard: F2/Delete PASS. Focus on an action button PASS (JS/hover path). ArrowRight route FAIL (BUG-1, medium).
- AC7 long names ellipsise: PASS (scrollWidth 352 > 230, full name in title). Row heights: two-line rows equal at 47px; no HEAD baseline, so "unchanged" is inferred.
- AC8 npm run check: PASS (exit 0; 199 Vitest, cargo suites ok).

Open bugs:
- BUG-1 medium (regression): ArrowLeft/Right no longer reach Edit/Forget with the pointer away. Sent to developer and staff-engineer.
- BUG-2 low (to confirm at HEAD): no keyboard focus indicator on rows navigated by ArrowDown. Sent to developer and staff-engineer.
Also: 520px is not testable (app minimum width is 1024). One seeded test step is flaky in the harness (2 of 5 runs failed on the hover/focus step); not a verified product bug.

Residual risk: keyboard action route until BUG-1 is fixed; reduced motion unverified in the running app; no HEAD row-height baseline.

Added (uncommitted, for the developer/PM to keep or drop): e2e/specs/source-row.e2e.ts, e2e/specs/source-row-real.e2e.ts, e2e/fixtures/seed/source-row/sources.json. Working tree source.css left untouched; nothing committed.
