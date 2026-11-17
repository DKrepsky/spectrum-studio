---
id: 0192
from: developer
to: staff-engineer
type: handoff
subject: T7 finish: 3 e2e reds fixed, Span and tag restored, full e2e 99/101 (2 known red)
work: 009-design-system
reply-to: 0189
date: 2026-11-16T20:43:04-03:00
---

T7 finish done, uncommitted. npm run check GREEN (exit 0: cargo fmt/clippy/test, prettier, eslint, tsc, vitest 50 files / 491 tests). Full npm run e2e: 99 passing, 2 failing: both known (ArrowRight flake, pre-existing; hover actions T9). Shots: evidence/after-T7/ (final run).

Root causes and fixes
1. Capture control width (1180, continuous vs single): SplitButton.css was NEVER IMPORTED by SplitButton.tsx. The contract test read the file from disk, so it passed, but in the app the main segment sized to its label (104 vs 128px) and the chevron to 38px. Fixed: `import './SplitButton.css'` in SplitButton.tsx. Group is now 154px in both modes (probe: main 128, chevron 26).
2. Center clipped 1px at 1180: the frequency field used the 8px field padding. Restored 7px via new token --field-padding-frequency (Field.css).
3. Visual "setup: a connected simulator" stuck at Connected: passes alone 3/3 before the fix and in the full visual run after it. Likely cause: the failing capture-width test left the mode on Single, so the next acquire was a single sweep that ended back at Connected. Not reproduced in isolation; now passes 46/47 in the visual spec (only the T9 red).
4. Restored old geometry (T7 drift) via tokens, all added to tokens.css AND DESIGN.md Appendix A and the 2.10 table (token test passes):
   --capture-main-gap 7px (was space-4 8px), --capture-main-padding-x 10px (was space-5 12px), --field-padding-frequency 7px, --plot-tag-padding-x 9px. All four are off-scale; kept from before 009.
5. Other drift fixed in this pass: Span select was content-sized before (now width auto via .toolbar-span in app.css; was 130px); plot tag was 18px with a neutral border, now 9px padding, body line height and tone border as before (T7 had chosen a neutral border; reverted to match before). These two reverse the T7 deviations listed in 0189.
6. Prettier: Toolbar.test.tsx had one unformatted expression from T7 (formatting only).

Tests: no test was weakened. capture.css.test.ts, SplitButton tests, Field tests, tokens.test.ts and Toolbar tests are green. A throwaway probe spec (deleted with its seed) measured the geometry.

Open for review (not fixed here, see PM handoff for the full list)
- Center and Span value text is now the primary text colour (brighter than before). Not an F-fix. PM to accept or restore grey.
- Span select is ~7px wider than before (select right padding token 12px). Residual, not fixed.
- Four new off-scale tokens need your review (DESIGN 2.10 says new code uses the scale; these restore pre-009 geometry).
- Lesson saved to developer memory: an unimported component CSS ships without styles, and a file-reading contract test does not catch it (css-import-silent.md). Consider a test that every src/ui/*/*.css is imported by its .tsx.
