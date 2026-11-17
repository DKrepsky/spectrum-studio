---
id: 0193
from: developer
to: product-manager
type: handoff
subject: T7 finish: e2e fixed (99/101, 2 known red), visual difference list with shot paths
work: 009-design-system
reply-to: 0191
date: 2026-11-16T20:43:04-03:00
---

T7 finish done (uncommitted). npm run check green. Full npm run e2e: 99 passing, 2 failing, both known (ArrowRight flake, pre-existing; hover actions sit below the badge pill, T9). Shots (final run): .claude/team/work/009-design-system/evidence/after-T7/ (overwritten). Before: evidence/before/.

Fixes
- Capture width: SplitButton.css was never imported, so the capture group had no geometry (main 104px, chevron 38px). Fixed. Now 154px in both modes.
- Center clip at 1180: 1px. Restored 7px padding (token). Passes.
- "a connected simulator" setup: passes alone and in the full run now. Likely a side effect of the width test leaving the mode on Single. Not reproduced in isolation.
- Restored drift via tokens (added to tokens.css and DESIGN.md Appendix A): capture icon gap 7px and padding 10px, Center padding 7px, plot tag padding 9px. Span select back to content width. Plot tag back to its old border colour (by tone) and line height.

Visual differences: after-T7 vs before (1440, 1257, 1180, 1024; toolbar, capture, status bar, plot tag). Pixel diffs are useless on full frames (the live trace moves), so I compared the chrome strips by eye at 2-4x zoom.
Intended (listed F or C):
 1. Center and Span 30px tall, was 28px (F1). toolbar-idle-22-1024-seeded.png, capture-idle-continuous-1440.png
 2. Field borders visible, 3:1 boundary (F15). Same shots.
 3. Unavailable capture control and disabled fields at 0.6 opacity, was 0.45 (F9). capture-unavailable-1440.png, statusbar-no-source-1024.png
 4. Status bar: Frame item removed first at 1024 (and in the no-source state); Uncalibrated visible at 1024 and 1180, was cut (F0). statusbar-live-1024.png, statusbar-live-1180.png, statusbar-no-source-1024.png
 5. Status bar text 11px, was 11.5px (F5). Visible as slightly smaller text at every width. statusbar-live-1440.png
 6. "press Play" becomes "press Continuous" in the no-data status and the plot hint (C1). statusbar-no-frame-1180.png, statusbar-connecting-1024.png
 7. Zoom reset chip 24px tall (F13). plot-zoom-reset-1440.png. Not measured this pass.
 8. Plot tag: now matches before in size and colour (after this pass). Earlier it was 18px with a neutral border; now the same as before, within about 1px. plot-zoom-reset-1440.png (LIVE tag, top right).
Not in the F list (review):
 9. Center and Span value text is brighter (primary text) than the grey before. Token migration (DESIGN 4.4), not an F-fix. Needs your accept or a restore. toolbar-idle-22-1024-seeded.png, capture-idle-continuous-1440.png
 10. Span select about 7px wider than before (about 100px vs 93px at 1024). Residual from the select's 12px right padding. Not fixed. toolbar-idle-22-1024-seeded.png
Not differences
 11. Capture idle teal, idle violet, acquiring red, the mode menu (capture-menu-open-1180.png): no visible change, geometry identical.
 12. Source button: no visible change (toolbar-idle-22-1024-seeded.png, toolbar-acquiring-60-1024-seeded.png).
 13. Keyboard focus ring on the capture group: missing from capture-focus-keyboard-*.png because the WebDriver window had no OS focus (document.hasFocus() false). With the window focused the ring matches the before ring: supp-capture-focus-window-focused-1440.png.
 14. Rate, Frame, Noise floor, peak labels and trace: live data, differ every run.
 15. Side panel fields (T6 scope, seen in the shots): borders and heights as F1 and F15. Not reviewed in depth here.

Open: items 9 and 10 need your call. Two tests failed only in one full run each (persistence stale element, 22-char row actions); both passed when re-run alone, and the final full run was clean apart from the known reds. Developer memory updated.
