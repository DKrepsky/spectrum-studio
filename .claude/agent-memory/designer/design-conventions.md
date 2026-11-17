---
name: design-conventions
description: Spectrum Studio visual and interaction conventions as verified in src/ (colour roles, measured widths and targets, status bar thresholds, contrast values, live-region and popover facts). Re-verify before relying on them; they change.
metadata:
  type: project
---

Verified 2026-11-16 (work 009, DESIGN.md 1.0-draft.2). Measured with `.claude/team/work/009-design-system/measure/build_harness.py` (headless Chrome, real CSS, fallback fonts: Ubuntu, DejaVu Sans Mono).

- **Status bar** (`app.css` `.status-bar`, `overflow:hidden`, `nowrap`): all 10 items need 1258px of window width. `Uncalibrated` is hidden from 1024 to 1257px, including 1180px. Without Frame it fits from 1078px; without Frame and Rate, at 1024px. Draft 1 wrongly said visible at 1180px.
- **Toolbar**: source button 280px (max) at 1024, 1180 and 1440, name visible 213px; Center 150px (128px at max-width 1180); capture 154px. Toolbar intact down to about 780 CSS px; overlaps below (capture over the Center field at 683 and 512 CSS px).
- **Side panel**: fixed 330px; rows have 305px usable width.
- **Targets (CSS px, today)**: capture main 128x30, chevron 26x30, Center 28.2 tall, Span select 26, side select 26, number input 28.2, `button.small` 22.8, marker × 23x20, notice dismiss 22.5x20, zoom reset 124.8x21.4, checkbox label 79x19, readout rows 27 (pass), popover rows 44/30 (pass).
- **Contrast** (computed): primary on panel 13.62; secondary on panel 6.11, on raised 5.58, on control 4.97, on the hover fill 4.38 (fails for text); teal on panel 10.43; focus ring blue on panel 7.12. Field border `#26344a` is 1.39:1 on panel, 1.27:1 on raised (fails 1.4.11). Proposed `#5b6f8f` gives 3.43 / 3.13.
- **Disabled**: 0.45 gives a primary label 3.48:1 on the control fill; 0.55 gives 4.45; 0.6 gives 5.00. Teal primary ink at 0.6 is 4.48.
- **Canvas**: traces all at least 3:1 on the plot; grid lines 1.22 to 1.59 (decorative); trace-to-trace luminance only 1.2 to 1.5:1 (colour alone is not enough).
- **Popover model in code** (today): `role="menu"` with `menuitem` row actions and `aria-haspopup="menu"` on the source button; every banner `role="alert"`. Capture mode menu is a correct `role="menu"` with `menuitemradio`.
- **Capture semantics** (work 006, unchanged): teal = Continuous, violet = Single, red = acquiring (Pause or Cancel). Amber never for running. Connected and acquiring look the same in the toolbar (both teal glyph).
- **Popover row geometry** (ruling 2026-11-16, `measure/row_geometry.py`): 24px row actions bottom-anchored under the badge overlap the badge pill by 4.2px at 44px, 2.1px at 48px, 0.09px at 52px. Centred in the 64px badge column (top 10px in a 44px row) they clear line 2 and need no extra height; the badge fades while they show. The row stays 44px.
- **Liveness copy bug**: while connecting or disconnecting the plot tag says "No source connected" (`liveness.ts`); the status bar says it too.
- **Stale** is a fixed 2 s (`STALE_AFTER_MS`), wrong for slow sweeps (open question Q-11).

**Why:** the team needs one set of measured facts so fixes and copy do not repeat wrong numbers.
**How to apply:** re-measure before quoting a width or a target; check `liveness.ts`, `NoticeBanner.tsx`, `SourceMenu.tsx` for the current behaviour before proposing a change.

Related: [[prototype-method]], [[feedback-review-expectations]]

## Token file and DESIGN.md Appendix A (verified 2026-11-16)
- `tokens.test.ts` compares Appendix A with `src/styles/tokens.css` including comments (only the alias marker is stripped). A stale comment ("Proposed (F9)") therefore needs one comment-only change to both files, which is a `src/` change: request it through the PM, do not edit `src/` as designer.
- Busy is not unavailable: a busy Button or Save keeps full strength; `--opacity-unavailable` only for actions that cannot run. The capture chevron is dimmed while a command runs (open as Q-23).
