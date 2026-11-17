---
id: 0160
from: developer
to: product-manager
type: handoff
subject: T1 done: after-shots in evidence/after-T1, hover styles identical, cascade fix in source.css
work: 009-design-system
reply-to: 0158
date: 2026-11-16T19:27:48-03:00
---

T1 foundation is done. Nothing committed. `npm run check` is green (cargo fmt/clippy/test, prettier, eslint, tsc, Vitest 275/275).

Files
- NEW src/styles/tokens.css: @layer legacy-controls; line 1, then DESIGN.md Appendix A verbatim, with the alias block marked `/* alias: migration only */`. --warn-strong dropped.
- MOD src/styles/app.css: :root token block removed (kept color-scheme: dark); control rules (button*, input*, select, .freq-input, focus, disabled) wrapped in @layer legacy-controls.
- MOD src/styles/source.css: two restated hover border rules (see cascade finding).
- MOD src/main.tsx: tokens.css imported before app.css.
- NEW src/test/css.ts (rule() with @layer/@media nesting), src/test/tokens.ts (parseTokens, resolveToken, colour and contrast helpers).
- NEW src/styles/tokens.test.ts; MOD capture.css.test.ts and source.css.test.ts (use the shared rule(); app token asserts now resolve through tokens.css, same values).
- MOD eslint.config.js: no-restricted-imports override for src/ui/**.
- NEW src/ui/boundary.test.ts (scan plus self-check), src/ui/README.md (5 lines).
- Evidence: evidence/after-T1/ (112 shots from the full e2e run plus 16 hover shots), evidence/before/ gained t1-hover-* shots and style JSON. Hover probe spec and seed were temporary and are deleted.

Tests
- tokens.test.ts (10): every var() defined; literal guard over non-legacy CSS plus self-check; LEGACY_FILES exist; --warn-strong gone; alias values equal the pre-T1 literals; 31 text (9.3) and 19 non-text (9.4) pairs (ratio >= need AND equals the table at 2 dp); Appendix A equals tokens.css.
- Breakage checks (restored, cmp-verified): palette teal changed -> 3 tests red; --control-height deleted -> undefined-token test red (3 CSS files) and Appendix test red; one Appendix A value changed alone -> Appendix test red.
- ESLint: a probe file importing state, ipc-like paths, @tauri-apps, zustand, plot, components and bindings gives 6 errors (removed afterwards).

e2e (npm run e2e, full suite, after build)
- 7 specs pass, 3 fail: visual "hover actions sit below the badge pill" (the known red, T9); source-row (one test) and acquisition (one test).
- Both non-visual failures also happen on the pre-change build (HEAD worktree, same spec): source-row focus test fails 3 of 3 isolated runs on both builds; acquisition single capture failed on one of two pre-change runs. The source-row hover test failed once in the full run and passed in isolated runs. Treat as pre-existing environment flakiness, not T1.

Before/after (evidence/before vs evidence/after-T1)
- Toolbar: pixel-identical in every state (idle, acquiring, connected, 22 and 60 char names, 1024/1180); all static panel shots are identical in the content regions. 44 shots identical overall.
- Differences found and explained, none in CSS: (a) plot and side panel content are live data (peak rows, Frame #, cursor position); (b) connecting/disconnecting dot phase (pulse) in 5 shots; (c) add-dialog and edit-connected name-field focus ring missing in the after shot, but the probe shows the same computed ring (2px solid #5aa9ff, offset 1px, focus-visible) on both builds, so it is screenshot timing.
- Hover states (computed style probe, 1024 and 1440): capture main, chevron, mode item, enabled row (checked and unchecked), row edit icon, unavailable row, `+ Marker` small button, primary Save: identical background, border, colour, outline, opacity, cursor on both builds. Full JSON: evidence/before/t1-hover-styles-*.json and evidence/after-T1/t1-hover-styles-*.json.

Cascade finding (plan section 5)
- Moving button:hover into a layer changes the winner for class-set hovers of rows: `.source-item` (0,1,0) now beats the global hover border #3a4d6b, and an aria-disabled row lost its hover bg #25344c. Fixed in source.css with `.source-item:hover:not([aria-disabled='true'])` (border var(--color-border-hover)) and `.source-item[aria-disabled='true']:hover` (bg var(--color-surface-control-hover), border var(--color-border-hover)). Computed values match the pre-change build. The unfixed state was reasoned from specificity, not measured.

Deviations from the spec
1. Appendix A includes the alias block, so the Appendix test compares it too (the spec said to ignore it). The only things removed before comparing are the `/* alias: migration only */` markers and the `@layer` line. A separate test pins alias values to the pre-T1 literals.
2. The literal guard checks no file yet (all four CSS files are in LEGACY_FILES); it is covered by a self-check fixture.
3. Contrast tests compare to the table at 2 dp (stricter than "pass"); all 50 pairs match, and contrast_pairs.py agrees.
4. Hover probe and after-run pixel check were done with throwaway specs; not committed.

Open items
- src/styles/app.css and the other legacy CSS files still hold literals (expected; T11 empties LEGACY_FILES).
- The e2e source-row focus and acquisition flakes exist on HEAD; worth a ticket outside 009.
- DESIGN.md Appendix A still says "Proposed" for F15/F9/B6 values; those values are what tokens.css carries (per spec).
