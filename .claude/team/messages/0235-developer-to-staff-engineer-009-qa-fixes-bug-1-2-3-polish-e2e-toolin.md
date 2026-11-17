---
id: 0235
from: developer
to: staff-engineer
type: handoff
subject: 009 QA fixes: BUG-1/2/3, polish, e2e tooling done
work: 009-design-system
reply-to: 0234
date: 2026-11-17T00:01:50-03:00
---

Work 009 QA fixes (request 0234). Nothing committed. `npm run check` EXIT 0 (52 files, 526 tests; re-run after the last edit). `npm run e2e` (full, build + 11 spec files) EXIT 0: 47 passing in visual, 0 failing, skips are the SA430 hardware cases. Visual spec alone also green (47 passing, 3 skipped).

1. BUG-1 (plot tags): `src/ui/Badge/Badge.css` drops `text-transform: uppercase` from `[data-variant='tag']`. The state words are already typed in caps in `src/state/liveness.ts` (LIVE, CAPTURING, HOLD); the rest keeps its case as before 009. Test: `src/ui/Badge/Badge.test.tsx` (tag rules carry no text-transform, plus a planted self-check).

2. BUG-2 (popover focus ring): `src/ui/Popover/Popover.css` `.list-row-select:focus-visible` uses `outline-offset: calc(-1 * var(--focus-ring-width))` (ring inside the row, same inset as the reduced-motion highlight). Test: `ListRow.test.tsx` geometry block, plus a visual-spec assertion (`menu-keyboard-focus`: focused row matches :focus-visible and its computed outline-offset is -2px).
   Evidence: `evidence/qa-fixes/bug2-*`. Pixel measurement (1440, row box x=158.9, y=114, 44px): before the outline was 2px at offset 1px, but the list clipped its left and right sides (only top and bottom showed). Now: ring pixels at x 159-160 and y 114-115, fully inside. This is inside, but not pixel-identical to the old look, which showed only top and bottom. Flagging it so the PM can accept it.

3. BUG-3 (px literals): every size and spacing literal outside tokens.css is now a token; only `0`, `1px`, `-1px` stay literal.
   - Scale tokens: e.g. brand, field and waterfall gaps, status-bar padding, glyph cells (`--glyph-cell`), `--panel-width`, `--font-size-xs`/`-lg`, `--focus-ring-width`/`-offset`, `--space-*`.
   - New named tokens (tokens.css + DESIGN 2.10 rows + Appendix A, comments identical): `--toolbar-padding-y` 7px, `--toolbar-field-gap` (space-3; 5px in the 1180 block), `--plot-zoom-reset-inset-left` 76px, `--plot-hint-padding-x` 40px, `--waterfall-tick-gap` 3px, `--legend-swatch-width` 10px, `--legend-swatch-height` 3px, `--button-icon-slot` 12px, `--menu-end-column` 16px, `--status-dot-ring-width` 2px, `--source-row-sub-min-height` 17px.
   - Guard: `src/styles/tokens.test.ts` `sizeViolations` over padding/margin/gap/inset sides/width/height/min-*/max-*/grid-template-*/flex/font-size/outline*/border widths; allow-list `HAIRLINE = ['0','0px','1px','-1px']`; self-checks; a test that the 12 replaced values still resolve to their old px.
   - Contract tests that pinned literals now pin the tokens: `Button.test.tsx`, `source.css.test.ts`.
   - Pixel evidence: computed-style probe (every element, 31 properties, rect) on pre-BUG-3 and post-BUG-3 builds: 0 differences in idle (181 elements, 1440 and 1024), zoom, popover, dialog, capture menu and live states outside the side panel. Idle screenshots are byte-identical (1440 and 1024). The side panel differs only by live peak and marker rows (simulator data), not by CSS. Files: `evidence/qa-fixes/bug3-pre3/`, `bug3-post3/`. The probe spec was throwaway and is deleted.

Polish: tokens.css and Appendix A comments are now "Approved (F9/F15)" and "Deferred (B6)" (same text in both; the token test passes). Field.css and Field.test.tsx "DESIGN.md 3.6" → 4.4. `src/styles/capture.css.test.ts` moved and renamed to `src/ui/SplitButton/SplitButton.geometry.test.ts` (describe: "SplitButton geometry contract"); DESIGN.md references updated. ADR 0015 §5 has a status paragraph: "the legacy-controls layer was removed in T11 (009)".

E2E tooling:
- `visual.e2e.ts` `resizeTo(width, height)`: waits until two `innerWidth` reads 100 ms apart agree, then pauses 150 ms. All direct 1440x900 resizes use it. Check: 99 shots from the visual run, 0 name/PNG-width mismatches (QA saw 79 of 181 across two runs). Evidence `evidence/qa-fixes/e2e-visual-run.log`.
- Hover flake: `helpers.ts` `revealRowActions` now calls `waitForRowStill` (row box equal on two reads 100 ms apart) before its single hover. I did NOT add a re-hover retry (retries are not allowed). Root cause not reproduced: the flake was 1 in 3 full runs earlier; two full runs since are green. Not proven fixed.
- `status-bar.e2e.ts` has its own resize helper without the settle wait; not changed (out of the named scope).

Not done (outside my scope): DESIGN.md Q-23 → Decided is a designer item in the polish list.
