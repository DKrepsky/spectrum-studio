---
id: 0280
from: qa
to: product-manager
type: report
subject: 012 QA re-test (round 2): ship, with BUG-012-QA-2 (low) and DESIGN corrections
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:52:47-03:00
---

Verdict: SHIP for issue 38 (all five acceptance criteria pass in the real app). Open: BUG-012-QA-2 (low, candidate issue) and two DESIGN.md corrections (3.2 and 3.9 rows) before merge. Full detail: .claude/team/work/012-measurement-center-span/qa.md, section "Re-test (round 2)".

Automated (this tree, uncommitted): npm run check EXIT 0 (cargo test 228 passed; Vitest 55 files, 699 tests). acquisition.e2e.ts 17 passing. visual.e2e.ts 47 passing, 3 skipped (hardware-only cases, as before). Build: tauri debug, no-bundle.

Re-test of the fixes:
- BUG-012-QA-1 (Center clipped at 1 GHz+): FIXED. 5.999000000 GHz fits at 1024 and 1440 (scrollWidth = clientWidth). Rows 140 x 28, aligned. Shots r2-center-ghz-1440-sim.png, r2-center-ghz-1024-sim.png.
- O1 focus: Enter keeps focus on Center; a Span pick keeps focus on Span (keyboard: Tab to Span, ArrowDown applies, focus stays; also on the SA430). Shots r2-focus-after-enter-center-1440-sim.png, r2-focus-span-after-arrowdown-1440-sim.png, r2-sa430-center-span-10M-1440-real.png.
- Applying: Center readonly and Span aria-readonly for about 37 ms, no focus loss (DOM). Too brief to check the look by eye.
- No source: Center and Span show an em dash and are disabled. Shots r2-nosource-1440.png, r2-nosource-1024.png.
- Regression: Escape revert works (Center); Source settings Hz commit applies (peak moves) and invalid input is not sent.

Per criterion (issue 38):
- AC1 toolbar brand + source group only: PASS (1440, 1024).
- AC2 Center, Span first in Measurement, same inline layout: PASS.
- AC3 connected: commit or pick applies, plot and status update: PASS (simulator; SA430 for Center and Span).
- AC4 disabled with the same reasons: PASS for no source (real app) and applying (DOM); untunable and fixed-span are unit tests only (no such source in this build).
- AC5 keyboard reachable, labels, DESIGN/unit/e2e updated: PASS (screen reader not run).

Open bugs:
- BUG-012-QA-2 (low, a11y): Enter on a Source settings Hz param drops focus to BODY (ParamForm disables the field while applying). Pre-existing, not a regression; not in 038's criteria. Bug sent to developer (0278), cc staff engineer (0279). Decide: fix in 038 or candidate issue.
- No other open bugs. Observations O6 to O9 in qa.md (WebDriver batch-typing artefact; zoom keys do nothing in this build; Escape blurs a field; Span read-only is too brief to see).

Measurements (numbers only, for DESIGN.md; simulated by document zoom at 1024 px; media queries not re-evaluated):
- Toolbar: no overlap at any width tested (1024 down to 465 CSS px). Capture control runs past the window edge at 427 CSS px (zoom 2.4), so clipping starts between 465 and 427. DESIGN 3.2 "intact down to about 780 px / overlaps the field group" is stale.
- 150% (683 px): toolbar fits; status bar drops Noise floor, Rate, Frame; panel rows intact. Shot r2-zoomcss-150-1024-sim.png.
- 200% (512 px): toolbar fits (the "Toolbar broken today" text in 3.9 is stale); status bar drops FFT and Avg too (5 items). Shot r2-zoomcss-200-1024-sim.png.
- Webview zoom keys (Ctrl+=, Ctrl+Shift+=, Ctrl+0) do not change the window's CSS width in this build: Q-5 answer for this build is "no".

Residual risk: low. The SA430 span round trip ran with the device paused (status strip not checked there). Screen reader not run. Real device restored to 433.92 MHz / 10 MHz.
