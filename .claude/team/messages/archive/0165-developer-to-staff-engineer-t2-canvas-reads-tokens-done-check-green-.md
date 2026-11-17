---
id: 0165
from: developer
to: staff-engineer
type: handoff
subject: T2 canvas reads tokens done: check green, visual e2e 46/47 (known red)
work: 009-design-system
reply-to: 
date: 2026-11-16T19:33:15-03:00
---

T2 (canvas reads tokens, E3) is done. Nothing committed.

Files
- src/plot/theme.ts: PLOT_THEME constant replaced by getPlotTheme(read?) (cached, resetPlotTheme()),
  PLOT_COLOUR_TOKENS (key to token map), PlotTheme type, TokenReader type. Missing or empty token
  throws "missing token --x". Font and monoFont = `${--font-size-xs} ${--font-family-ui|mono}`.
  PLOT_INSETS unchanged. No hex literal left in the file.
- src/plot/spectrumRenderer.ts: imports getPlotTheme; drawSpectrum, drawGrid, drawTraces, drawPeaks,
  drawMarkers, drawCrosshair each call getPlotTheme() at draw time (one line each). Logic untouched.
- src/components/WaterfallView.tsx: only the PLOT_THEME use (clear() uses getPlotTheme().plotBackground) and import.
- src/plot/theme.test.ts (new): 6 tests. Colour keys match the old literals (compared as rgba
  numbers, so 0.1 == 0.10); fonts match after quote normalisation; every key maps to a token in
  tokens.css; missing/empty token throws naming it; cache and reset; drawSpectrum paints the
  background and plot area with the token colours (fake 2d context, cache pre-warmed with the resolver).

Deviations
- Font strings keep the token file's single quotes (`11px 'Inter', ...`); canvas parses them the
  same. The test normalises quotes to compare with the old literal.
- getPlotTheme caches the first call, whatever the reader; the injectable reader is only honoured
  on the first call (tests call resetPlotTheme first). Documented in the code.
- Appendix B maps readoutBackground to --color-scrim-readout (the task text said readout text only);
  implemented per Appendix B.

Checks
- npx vitest run src/plot src/components: 164 passed (before the new test count changed: src/plot 24 passed).
- npm run check: EXIT=0 (cargo fmt, clippy, cargo test, prettier, eslint, tsc, vitest), run after
  all edits.
- npm run e2e visual spec (debug build, WebKitWebDriver from apt download): 46 passed, 1 failed:
  "hover actions sit below the badge pill instead of covering it" (the known red test on main,
  "actions top 223.5 vs badge bottom 242"). Shots in evidence/after-T2 (98 files).
- Canvas check: statusbar-connecting-1440 plot region identical to before (diff bbox empty) at
  1024, 1180, 1257 and 1440 too (same frameless state). Live shots differ (simulator data varies,
  and the side panel differs from before because the tree has other in-progress work), so they are
  not a pixel proof; the trace colour #ffd166 is present in the hold shots.

Not done / notes for the next tasks
- Before-shots on main contain the old side panel; compare panel shots against after-T1 for
  non-canvas drift, not against before.
- No renderer test existed before; any future test that draws without first calling
  getPlotTheme(resolver) will throw the missing-token error by design.
