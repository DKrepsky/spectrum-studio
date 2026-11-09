# 002 Source row polish: QA

Tested: uncommitted working tree (`src/styles/source.css`, `source.css.test.ts`, SourceMenu doc comment)
on the debug build (`npx tauri build --debug --no-bundle`, WebKitGTK, real TI SA430 on /dev/ttyACM0).
Window: 1180x820; the app's minimum width is 1024 (`src-tauri/tauri.conf.json` minWidth), so 520px
could not be tested (the window clamps to 1024).

Specs added (uncommitted, under e2e/): `e2e/specs/source-row.e2e.ts` (seeded visual fixture, seed in
`e2e/fixtures/seed/source-row/`), `e2e/specs/source-row-real.e2e.ts` (no seed: real detected SA430 and
fixed Simulator). Run: `npm run e2e:run -- --spec <file>` with `SPECTRUM_E2E_SHOTS` set to `screenshots/`.

## Verdict: DON'T SHIP YET

Everything the story asks for works in WebKitGTK except one keyboard path: ArrowLeft/ArrowRight to the
row's Edit/Forget buttons no longer works (BUG-1, medium). Fix it, then re-test (the rest is verified).

## Test matrix (acceptance criteria)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | Transport tag vertically centred: two-line rows and single-line fixed items | PASS | Two-line row (SA430): badge centre y 92.5 = row centre 92.5 (item 69–116). Remembered simulator (two-line): badge 327.5 = centre 327.5. Fixed Simulator (single-line, real run): badge 140 = centre 140 (125–155). Tolerance 1.5px. `screenshots/hover-two-line-1180-visual.png`, `screenshots/rest-two-line-1180-visual.png`; logs `evidence/e2e-real-run3.log`, `evidence/e2e-seeded-run6-final.log` |
| AC2 | Edit/Forget not visible when menu opens, incl. keyboard-focused row | PASS | At open, all 6 rows: actions `visibility:hidden; opacity:0; pointer-events:none`, badge opacity 1. Focus on first row (vis-real) with hidden actions. ArrowDown onto a row: its actions hidden. `screenshots/menu-open-1180-visual.png`, `screenshots/focus-keyboard-1180-visual.png` (pass) |
| AC3 | Hover reveals with ~150ms slide from left; leave hides | PASS (CSS-level timing, see note) | Computed transition `opacity 0.15s ease-out, transform 0.15s ease-out, visibility …`. transitionstart fired for opacity and transform on hover. Start `translateX(-6px)`, end `none`. Leave: hidden again after 400 ms, badge back to opacity 1. Note: the slide is 6px (design value); a mid-frame screenshot is not possible through WebDriver, so timing is from the computed transition and the transition events. `screenshots/hover-two-line-1180-visual.png` |
| AC4 | Buttons vertically centred, aligned, occupy the tag column, no overlap with name/line 2 | PASS | Both buttons centre y 92.5 = row centre (`buttonCys` equal). Button columns x 420.9–484.9 = badge column (64px). Name box right edge 411.9, so 9px clear of the buttons. Long row too: buttons centre 186.5 = row centre. `screenshots/hover-two-line-1180-visual.png`, `screenshots/hover-long-1180-visual.png`, `screenshots/hover-long-1024-visual.png` |
| AC5 | `prefers-reduced-motion: reduce` shows buttons without slide | NOT RUN | WebKitGTK reports `matchMedia('(prefers-reduced-motion: reduce)').matches === false` both normally and with GNOME `enable-animations` off (setting restored to true afterwards). The media rule cannot be exercised in the app here. Only the static CSS contract (`source.css.test.ts`) covers it. |
| AC6a | F2 / Delete shortcuts unchanged | PASS | Spec "F2 opens Edit and Delete forgets…": F2 on focused row opens the Edit dialog; Delete shows the Undo toast and Undo restores the row (`evidence/e2e-seeded-run6-final.log`). |
| AC6b | Keyboard focus landing on an action button shows its actions | PASS for focus that lands on a visible button (JS focus while hovered; focus-within keeps the row revealed after pointer leaves, badge faded via `:has()`). FAIL for the keyboard route (ArrowRight) | `screenshots/focus-action-1180-visual.png`. See BUG-1 |
| AC6c | `:has()` in this WebKitGTK | PASS | `CSS.supports('selector(:has(a))') === true`; badge opacity 0 while an action is focused (focus-within). |
| AC7a | Long device names still ellipsize | PASS | 60-char name: `scrollWidth 352 > clientWidth 230`, full name in `title`. `screenshots/hover-long-1180-visual.png` |
| AC7b | Row heights unchanged | PARTIAL | Two-line rows are 47px (item 69–116) with equal heights in every row. Fixed single-line item 30px. No HEAD baseline measured, so "unchanged" is only inferred from the unchanged min-height and grid. |
| AC8 | `npm run check` passes; SourceMenu tests pass | PASS | `npm run check` exit 0: cargo fmt/clippy/test (all suites ok), prettier, eslint, tsc (app + e2e), Vitest 22 files / 199 tests. `evidence/npm-run-check.log` |

## Edge cases and regressions

| Case | Result | Evidence |
| --- | --- | --- |
| Real hardware (TI SA430 on USB) detected row: hover reveals single Edit centred, badge faded, rest hidden | PASS | `screenshots/hover-detected-real-1180-real.png`, `screenshots/rest-detected-real-1180-real.png`, `screenshots/menu-open-real-1180-real.png`; `evidence/e2e-real-run3.log` |
| Long names (60 chars, 22 chars), real 22-char SA430 name | PASS | `screenshots/menu-open-1180-visual.png` |
| Keyboard: ArrowRight from a row reaches Edit/Forget (pointer away) | FAIL | BUG-1. `screenshots/focus-arrowright-1180-visual.png`: focus stays on the row (`data-menu-action` null). |
| Keyboard: ArrowRight while the row is hovered | PASS | Focus lands on Edit (`data-menu-action="edit"`). |
| Keyboard focus ring on a row navigated by ArrowDown | NOTE (BUG-2) | `screenshots/focus-keyboard-1180-visual.png`: no visible ring on the focused row. |
| Narrow window | PARTIAL | App minimum is 1024px; the 1024 layout was checked (`hover-long-1024-visual.png`, no sideways scroll, buttons centred). 520px is not reachable. |
| Forget/Undo/F2 still work after the change | PASS | see AC6a |
| Visual: no overlap or clipping of buttons in hover state | PASS | Screenshots reviewed (see below) |

## Visual inspection (each screenshot viewed)

| Screenshot | Finding |
| --- | --- |
| `screenshots/menu-open-1180-visual.png` | OK. No buttons, all badges visible, names ellipsised (`Very long source name used to check...`), menu inside window. |
| `screenshots/menu-open-real-1180-real.png` | OK. Real detected SA430 (`SA430 08FF41E50F8B3A34`, USB badge) and Signal simulator; no buttons. |
| `screenshots/focus-keyboard-1180-visual.png` | DEFECT (BUG-2, low). Keyboard-focused row (`Very long…`) shows no focus indicator at all: no background, no outline. |
| `screenshots/focus-arrowright-1180-visual.png` | DEFECT (BUG-1). Focus on `Bench SA430 analyzer 2` (blue ring from `button:focus-visible`), but ArrowRight did not reveal or reach the buttons. |
| `screenshots/hover-two-line-1180-visual.png` | OK. ✎ and × centred on the row midline, same y, badge gone, no overlap with name or line 2. |
| `screenshots/hover-simulator-1180-visual.png` | OK. Hovered remembered simulator row; ✎ × visible; a blue ring on the Bench row is the stale keyboard focus from the test, not a defect. |
| `screenshots/hover-long-1180-visual.png` | OK. 60-char name ellipsised at the buttons' left edge with a gap; buttons centred; no clipping. |
| `screenshots/hover-long-1024-visual.png` | OK. Same at the 1024 minimum. |
| `screenshots/focus-action-1180-visual.png` | OK. Edit focused, row revealed after pointer left, badge hidden. No focus ring is drawn on the ✎ (focus came from script after a mouse hover, so `focus-visible` does not match). Expected. |
| `screenshots/hover-detected-real-1180-real.png` | OK. The single detected-row Edit is centred in the column (x≈452) rather than at the two-button position (≈438). Consistent with "centred"; minor, not a defect. |
| `screenshots/rest-detected-real-1180-real.png` | OK. Badge back, no buttons. |
| `screenshots/rest-two-line-1180-visual.png` | OK. Badges vertically centred in two-line rows. |

## Bugs

### BUG-1 (medium): ArrowLeft/ArrowRight can no longer reach Edit/Forget
Summary: `.source-actions` is `visibility:hidden` until hover or focus-within. A row can't reveal its
buttons from keyboard focus (AC2), and hidden buttons cannot take focus. So the ArrowRight handler
in `useMenuKeys` (documented as "Left/Right for the row actions") does nothing when the pointer is
away from the row. HEAD revealed the actions with `.source-row:focus-within`, so this is a regression.
Steps to reproduce: open the source menu with the mouse away; ArrowDown to a remembered row; press ArrowRight.
Expected: focus moves to the row's ✎ (edit) button, which is visible.
Actual: focus stays on the row; no button is focused; the row's buttons stay hidden.
Evidence: `screenshots/focus-arrowright-1180-visual.png`; probe output in `evidence/e2e-seeded-run4-flaky-action-focus.log` ("QA ArrowRight result": testid `source-entry-vis-22`, menuAction null). Hovered control: "QA ArrowRight while hovered focuses: edit".
Suspected area: `src/styles/source.css` `.source-actions` (`visibility: hidden` blocks focus). A fix that keeps the buttons focusable while still invisible (e.g. `opacity:0; pointer-events:none` instead of `visibility:hidden`, reveal on `.source-actions:focus-within`), or any other way that makes ArrowRight reach the buttons. Accessibility trade-off to decide: opacity-hidden buttons stay in the accessibility tree. Add a regression test for ArrowRight from a not-hovered row.

### BUG-2 (low, probably pre-existing; to confirm at HEAD): keyboard-focused row shows no focus indicator
Summary: after ArrowDown moves focus to a row, the row has no visible focus state: `:focus-visible` is false, background is transparent, outline is `none`. The rule `.source-item:focus-visible { background: surface-3 }` does not apply. Programmatic focus of the same row does show the global blue outline (`button:focus-visible`), so the keyboard case differs.
Steps to reproduce: open the menu; press ArrowDown twice; screenshot.
Expected: focused row visibly highlighted (AC does not name this, but design/focus-visible rule intends it).
Actual: no highlight.
Evidence: `screenshots/focus-keyboard-1180-visual.png`; probe in `evidence/e2e-seeded-run6-final.log` ("QA keyboard focus": focusVisible false, outline none).
Suspected area: `source.css` `.source-item:focus-visible`, and an `outline` reset on `.source-item`. The diff does not touch these rules; verify at HEAD before fixing.

## Test-quality notes (for the developer and staff engineer)
- `src/styles/source.css.test.ts` checks CSS text (selectors, widths, strings). It does not check behaviour; the behaviour is covered only by the e2e specs above. Those specs are new and uncommitted; whether to keep them is for the developer/PM.
- The seeded spec failed at the "focus on an action button" step in two runs (run 4 and run 5, logs in evidence/) and passed in run 6 after a debug line changed the timing. A debug probe showed the button focused but `visibility: hidden` right after the JS focus. The cause was not found. Treat it as a harness or hover-timing flake to watch, not a verified product bug, but it is a reason to check the focus path again after the BUG-1 fix.

## Residual risk
- Reduced motion not exercised in the app (AC5). The CSS block is simple (no transitions), but unverified.
- Keyboard action route broken until BUG-1 is fixed.
- 520px width not testable (app minimum 1024).
- No HEAD baseline for row heights.
