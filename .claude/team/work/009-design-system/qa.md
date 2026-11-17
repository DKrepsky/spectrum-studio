# 009 Design system: QA report (final)

Tester: qa. Date: 2026-11-16 (run 2026-11-16/17, local time). Build: `npx tauri build --debug --no-bundle` of the working tree (nothing committed, nothing reset).
Evidence root: `.claude/team/work/009-design-system/evidence/`. Composites and reviewed crops: `screenshots/`.

## Verdict: SHIP (final, 2026-11-17)

Superseded the first verdict (don't ship yet) after the re-verification below: BUG-1, BUG-2 and BUG-3 fixed and observed; gates green. Open items: the SA430 row-action flake (not a product regression by evidence) and two visible changes for the PM to confirm (BUG-2 ring sides, toolbar 45px). The first verdict text follows for the record.

### First verdict (2026-11-16)

Everything that is a gate passes (`npm run check` green, unit and guard tests green, the visual guard green in two full visual runs, the docs images re-shot). Three minor defects block a clean "ship as approved":

1. **BUG-1 (minor, visible, unlisted):** plot tags are typed in capitals by CSS (`HOLD · LAST DATA`, `NO SOURCE CONNECTED`). Not in F0 to F17, C1 or the decision list. DESIGN.md 8 says sentence case, caps only as a style for group labels and section titles; the DESIGN.md 3.x example reads `HOLD · last data`.
2. **BUG-2 (minor, visible, unlisted):** the source popover keyboard focus ring moved from inside the row to outside it. B1 says "looks the same". Not in the decision list.
3. **BUG-3 (minor, AC 2 not met):** non-token size and spacing literals remain in feature and component CSS (about 60 lines outside `tokens.css`). The token guard checks colour, shadow, radius and z-index only, so the DoD line "no non-token literal left in CSS" is not enforced and is not true.

Each is small. Ship when the PM either fixes them or accepts them as decisions (BUG-1 and BUG-2 can be accepted as visible changes; BUG-3 needs a fix or a written exception). Residual risks are at the end.

## Acceptance criteria (story.md)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | `DESIGN.md` at root with principles, tokens (colour incl. semantic capture roles, type, spacing, radius, elevation, motion, z-index), layout, component catalogue, interaction and keyboard, content, accessibility, how to change a token or component; linked from `docs/README.md` | **Pass** | `DESIGN.md` (2396 lines): sections 1 to 14 and Appendices A and B; headings 2.1 to 2.19 (tokens incl. 2.5 capture semantics, 2.8 type, 2.9 spacing, 2.11 radius, 2.12 elevation, 2.13 motion, 2.14 z-index), 3 layout, 4 components, 5 interaction (5.10 keyboard map), 8 content, 9 accessibility (9.3/9.4 contrast, 9.8 focus, 9.13 motion, 9.9 target size), 10 governance (10.2 components, 10.4 visual check). `docs/README.md` line 14 links `../DESIGN.md`. |
| AC2 | Every token in DESIGN.md exists as a single source (CSS custom properties); no hard-coded colour or spacing in component CSS except as DESIGN.md allows | **Fail (BUG-3)** for size and spacing; **pass** for colour, shadow, radius and z-index | Single file `src/styles/tokens.css`; `tokens.test.ts` (part of `npm run check`, 519 tests pass) compares it with DESIGN.md Appendix A and rejects undefined `var()` and colour, shadow, radius and z-index literals outside the file. Grep `src/**/*.css` for `#hex`, `rgb(`: none outside tokens. Grep for px literals other than 0 and 1px: about 60 hits in `src/styles/app.css` (33; e.g. `font-size: 11px` x4 = `--font-size-xs`, `gap: 6px`, `padding: 7px`, `left: 76px`, `width: 330px`, `padding: 0 40px`), `src/components/source/source.css` (5; `outline: 2px`, `min-height: 17px`), `SourceDialog.css` (3), `src/ui/Button/Button.css` (12px icon slot), `src/ui/Menu/Menu.css` (`16px` column), `src/ui/Popover/Popover.css` (`calc(1px + ...)` only). DESIGN.md 2.17 allows `0`, `1px` and token-derived `calc`; the rest is "a finding in review". |
| AC3 | General components in `src/ui/`, presentational (props in, callbacks out; no IPC, state, session, device) | **Pass** | 17 folders in `src/ui/` (Badge, Banner, Button, Dialog, Field, hooks, IconButton, InlineMessage, LiveRegion, Menu, Popover, Section, Spinner, SplitButton, StatusDot, StatusStrip, Table). Guard probe (below) proves the guard fails. |
| AC4 | Feature code uses `src/ui/` instead of its own duplicates; duplicated markup and CSS removed | **Pass** (one accepted exception) | 19 feature files import `../ui/*` or `../../ui/*`. Removed: `src/components/FrequencyInput.tsx`, `NumberInput.tsx`, `source/useFocusTrap.ts`, `source/useMenuKeys.ts`, `StatusGlyph`; `legacy-controls` layer gone (grep: none in `src`). Remaining raw `<button>` is `src/components/source/SourceButton.tsx` (the trigger; DESIGN 10.2 rule 1 and PM decision T11 accept it as feature markup). |
| AC5 | Each `src/ui/` component has unit tests (render, variants, states, keyboard and a11y) | **Pass** | Every component folder has a `.test.tsx` (Badge, Banner, Button, Dialog, Field (Field, FrequencyField, NumberField), IconButton, InlineMessage, LiveRegion, Menu, Popover (Popover, ListRow), Section, Spinner, SplitButton, StatusDot, StatusStrip, Table) plus `hooks/useListKeys.test.tsx`. `npm run check`: Vitest 52 files, 519 tests, all pass. |
| AC6 | ADR records the ui/feature boundary and the token approach; lint or test guard prevents `src/ui/` importing IPC, state, bindings | **Pass** (doc nit) | `docs/adr/0015-ui-feature-boundary-and-design-tokens.md` (accepted). Guards: ESLint `no-restricted-imports` (`eslint.config.js`) and `src/ui/boundary.test.ts`. **Doc nit:** ADR section 5 still describes the `@layer legacy-controls` cascade layer as present; the layer was removed (no occurrence in `src`). Update the ADR to say so. |
| AC7 | App looks the same except the approved small fixes; QA verifies visually with before and after of every screen and state | **Fail (BUG-1, BUG-2)** for the two unlisted changes; **pass** for everything else checked | Visual guard run twice (see Visual). Difference table below. Screenshots reviewed one by one (list below). |
| AC8 | `npm run check` and `npm run e2e` green; docs (`architecture.md`, `guidelines.md`) updated | **check: pass. e2e: 1 red test, not reproduced on re-run (flake, see E2E)** | `docs/architecture.md` rows for `src/ui/`, `src/components/`, `src/styles/tokens.css`, `src/plot/`, `src/format/` and a "Frontend layers and design tokens" section; `docs/guidelines.md` "Build UI from `src/ui/`", "`src/ui/` is presentational", "Design source" and test rules. |

### Work-item tasks (tasks/T13.md and plan section 12)

| Item | Result | Evidence |
| --- | --- | --- |
| Visual after-shots (`evidence/after-final`) paired with `before/` | Done, with a tooling defect: names do not match the image width in many shots (see Visual) | `evidence/after-final/` (88 files), `evidence/after-final-r2/` (93 files) |
| Difference table | Done | below |
| 1440, 1180, 1024, narrow, long names, status bar "Uncalibrated" at every width | Pass for status bar (1440, 1257, 1180, 1024 checked on real widths); long names checked (22 and 60 characters) | `screenshots/statusbar-live-all-widths-r2.png`, `screenshots/compare-row-actions-1180-long.png` |
| Keyboard focus rings and keyboard-only walkthrough of popover, mode menu, dialog | Pass with BUG-2 note | `evidence/qa-kb/*.png`, probe results below |
| Reduced motion | **Not run.** WebDriver cannot set `prefers-reduced-motion` on this WebKit. Static check only: `@media (prefers-reduced-motion: reduce)` present in `src/styles/tokens.css`, `src/ui/Spinner/Spinner.css`, `src/ui/Popover/Popover.css` (2 blocks), `src/ui/StatusDot/StatusDot.css`. | - |
| `docs/images/main-window.png` re-shot | Done (not committed) | `docs/images/main-window.png` (shows Continuous, no Stop/SIMULATED/Export CSV, `Uncalibrated` in status bar) |
| `docs/images/source-menu.png`, `edit-source.png` checked and re-shot | The old `main-window.png` was stale (Stop, SIMULATED, Export CSV). The old `source-menu.png` and `edit-source.png` were not compared in detail; both were re-shot with `npm run docs:screenshot` (`e2e/screenshot.conf.ts`, `e2e/tools/screenshot.ts`) and the new images were checked against the current UI. | `docs/images/source-menu.png`, `docs/images/edit-source.png`; old copies in `scratchpad/docs-before/` |
| Ctrl+= / Ctrl+- (Q-5) | Does not zoom. Report only. | Zoom probe below |

### Unit and guard checks

- `npm run check`: **EXIT 0**. `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --workspace` (every suite `ok`: 98, 30, 8, 16, 25, 33, 3, 12 passed; 0 failed; 6 and 1 ignored, hardware tests), Prettier, ESLint (`--max-warnings 0`), `tsc` for app and e2e, Vitest 52 files / 519 tests.
- **Guard probe (proves the guards bite):** temporary file `src/ui/Button/ZzProbe.tsx` importing `../../state/store` and `@tauri-apps/api/core`:
  - `npx vitest run src/ui/boundary.test.ts` → fails: `Button/ZzProbe.tsx: imports path through "state"`, `imports package @tauri-apps/api/core`.
  - `npx eslint src/ui/Button/ZzProbe.tsx` → 2 errors, `no-restricted-imports` ("src/ui/ is presentational (ADR 0015)").
  - Probe file removed; `src/ui/Button` back to 4 files.
- Test review (by test titles and reading the assertions of the listed tests): `SourceMenu.test.tsx` covers the B1 behaviour (dialog role, no menu or menuitem roles, no type-ahead, `aria-current`, Tab and Escape close, focus return); `tokens.test.ts` reads the real token file and compares it with DESIGN.md Appendix A. These are behaviour assertions, not render-only. I did not audit every component test.

## E2E

| Run | Command | Result |
| --- | --- | --- |
| Visual only, run 1 | `SPECTRUM_E2E_SHOTS=…/evidence/after-final npm run e2e:run -- --spec e2e/specs/visual.e2e.ts` | 47 passing, 3 skipped (hardware), EXIT 0 |
| Visual only, run 2 | same, `…/evidence/after-final-r2` | 47 passing, 3 skipped, EXIT 0 |
| Full `npm run e2e` (build + 11 spec files) | `PATH=<wkd2>:$PATH npm run e2e` | 10 of 11 spec files passed. **1 failing:** `visual.e2e.ts` "hover actions replace the badge: the badge fades, the actions are centred in its column": `Error: the row actions did not appear` (helpers.ts `revealRowActions`, visual.e2e.ts:600). Log: `scratchpad/qa-e2e-full.log`. EXIT 1. |
| Re-run of the failing test alone | `--mochaOpts.grep "hover actions replace the badge"` | **1 passing**, EXIT 0 (`scratchpad/qa-visual-hover-rerun.log`). Classified as a flake of the hover reveal under the full run (memory: `e2e-quirks.md`, "row-action click flake"). Not a product regression by this evidence. Staff engineer: look at the reveal wait in this test; it is the same area as the 2 earlier full-run reds. |

Hardware: `SPECTRUM_E2E_SA430` not set, so the SA430 cases were skipped by design. The full run logged `could not connect source driver=sa430 … /dev/ttyACM6` from seeded rows (expected, fake port names).

## Visual (AC7)

### Tooling defect found (QA, not product)

`visual.e2e.ts` names each shot with the `innerWidth` read after `setWindowSize` (250 ms), but `saveScreenshot` sometimes captures the previous width. Name and image disagree in both runs:
- run 1: 51 of 88 named-width shots have a different real width;
- run 2: 28 of 93, all in the `statusbar-*` and `panel-*-1440` and `typical-menu-1180`, `button-*-1180`, `absent-device-menu-1024`, `hover-actions-…-1024` groups.
- The T0 `before/` set has 0 mismatches.

So for the review I took the width from the PNG header, not the name. Pairs used below are by real width. Fix for the test owner: wait until `innerWidth` is stable for two reads after the resize, or derive the name from the image size. Not fixed by QA (test code change left to the owner).

### Difference table (before = T0 `evidence/before/`, after = `evidence/after-final` or `after-final-r2`, by real width)

| # | Where (real width) | Visible change | Item | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Idle copy, plot placeholder and status bar, all widths (`compare-capture-idle-continuous-1440.png`) | "press Play" → "press Continuous" | C1 | OK (approved copy) |
| 2 | Status bar, all widths (`statusbar-live-all-widths-r2.png`) | `Uncalibrated` always visible at 1440, 1257, 1180, 1024; before it was cut at 1024 to 1257 | F0 (+ E6) | OK |
| 3 | Status bar text size | 11px instead of 11.5px, narrower | F5 | OK |
| 4 | Disabled Continuous, Peak search, Reset etc. (`compare-banner-device-lost-1440.png`, `compare-capture-unavailable-1440.png`) | Disabled controls are a bit lighter (0.6 instead of 0.45/0.5) | F9 / Q-3 | OK |
| 5 | Field and select borders (`compare-typical-menu-1024.png`, `compare-capture-idle-continuous-1440.png`, `compare-narrow-1024.png`) | Input and select boundary lighter (3:1) | F15 | OK |
| 6 | Checkboxes (Max hold, Detect peaks, Waterfall) | Teal instead of WebKit blue | F16 (accepted T6) | OK |
| 7 | Center and Span value text (toolbar, `compare-narrow-1024.png`) | Primary colour, not inherited | F17 (accepted T7) | OK |
| 8 | Span select, toolbar at 1024 | About 7px wider | T7 accepted | OK |
| 9 | Popover rows (`compare-typical-menu-1024.png`, `compare-row-actions-1180-long.png`) | Rows 44px, 47px pitch as before; row actions 24px, centred in the badge column on hover (`kb-popover-tab.png`, `hover-actions-replace-badge-1024-long-name.png`) | F2 / ruling 0198 | OK |
| 10 | Popover group labels | Caps labels aligned to the glyph column | F3 | OK |
| 11 | Undo toast (`compare-menu-undo-toast-1440.png`) | Button restyled as secondary, text unchanged | T9 accepted | OK |
| 12 | Capture mode menu (`compare-capture-menu-1024.png`) | Heading and items as before; focus ring offset | F4 (keyboard only) | OK |
| 13 | Capture control focus (`compare-capture-focus-keyboard-1440.png`) | Ring visible, same | F4/9.8 | OK |
| 14 | Add dialog (`compare-add-dialog-1024.png`) | Field labels and help text sizes, field boundary; Save and Cancel unchanged | F6, F7, F15 | OK |
| 15 | Banners (`compare-banner-device-lost-1440.png`, `compare-banner-warning-1024.png`) | Tint and text as before; Reconnect secondary button | F10, B2 (no visual) | OK |
| 16 | Side panel sections (`compare-typical-menu-1024.png`, `compare-capture-idle-continuous-1440.png`) | Caps section titles, heading spacing as before; Max hold teal | F16 | OK |
| 17 | Plot tag text (`compare-banner-device-lost-1440.png`, `compare-narrow-1024.png`, `compare-menu-undo-toast-1440.png`) | **Whole tag text in capitals**: `HOLD · last data 19:03:53` → `HOLD · LAST DATA 23:31:28`; `No source connected` → `NO SOURCE CONNECTED` | none | **BUG-1** |
| 18 | Popover focus ring (`compare-menu-keyboard-focus-1440.png`, `qa-kb/kb-popover-tab.png`) | Ring moved from inside the row to outside it (2px solid `#5aa9ff`, 1px outward) | none (B1 says no visual change) | **BUG-2** |
| 19 | Hover state on a row when the pointer rests on it (`compare-menu-keyboard-focus-1440.png`, after) | Row actions visible on the pointed row. Pointer position, not a style change. | - | Not a defect |
| 20 | Live data differences (peak values, waterfall, frame counter, clock) | Data, not design | - | Not compared |

Not reviewed in this pass (no matching real-width pair, or not opened): the `panel-*` shots (Measurement, Markers, Peaks, Display, Source settings, invalid field), the toolbar 22/60-character shots at 1180, `plot-tag-waiting`, `plot-zoom-reset`, the connecting and hold status bars at 1257, and the banner-warning at 1440. These are the gaps in AC7 coverage; the T10, T11 and T6 composites in `evidence/compare-T*/` were made by the developers and I did not re-check them.

### Screenshots reviewed (look-at, with finding)

| Shot (path) | Finding |
| --- | --- |
| `evidence/after-final/typical-menu-1024-seeded.png` (vs before) | ok. Popover, Continuous teal, `Uncalibrated`. |
| `evidence/after-final-r2/statusbar-live-1024.png` (real 1440) etc. → `screenshots/statusbar-live-all-widths-r2.png` | ok at 1440, 1257, 1180, 1024. Frame and Rate drop first at 1024, `Uncalibrated` stays. |
| `evidence/after-final/menu-keyboard-focus-1440.png` | ok; BUG-2 ring change. |
| `evidence/after-final/menu-undo-toast-1440.png` | ok. |
| `evidence/after-final/capture-idle-continuous-1440.png` | ok; C1 copy. |
| `evidence/after-final/banner-device-lost-1440.png` | BUG-1 (uppercase tag). |
| `evidence/after-final/narrow-1024-seeded.png` | BUG-1 (tag). Otherwise ok. |
| `evidence/after-final/row-actions-1180-long-name.png` | ok; 60-char name ellipsised with the full name in `aria-label`. |
| `evidence/qa-kb/kb-popover-open.png`, `kb-popover-tab.png` | keyboard: popover open, Tab moves to the pencil (ring visible). BUG-2 applies. |
| `evidence/qa-kb/kb-mode-menu-open.png` | ok. Continuous checked, Single listed with its description. Heading caps as before. |
| `evidence/qa-kb/kb-chevron-locked-focus.png` | ok; chevron aria-disabled while acquiring (mode cannot change while acquiring). |
| `evidence/qa-kb/kb-dialog-tab.png` | ok; focus ring on Serial port. |
| `docs/images/main-window.png` | ok. |
| `docs/images/source-menu.png`, `docs/images/edit-source.png` | ok. |

## Keyboard walkthrough (run with WebDriver keys, window focused)

- Source button: focus, Enter → popover opens with focus on the active row (`source-entry-…`). ArrowDown → next row. Tab → row's Edit pencil (solid 2px `rgb(90,169,255)` focus ring). Escape → popover closes, focus returns to the source button (`aria-label` "Source: Signal simulator, Acquiring"). OK.
- Capture mode chevron: while acquiring it is `aria-disabled="true"`; Enter does not open the menu (mode locked while acquiring, as DESIGN says). After Continuous is paused: Enter opens "Capture mode" menu; focus lands on the first item; Escape closes and returns focus to the chevron. OK.
- Acquire button: focusable, ring visible. OK.
- Add source dialog: opens with focus on Name (ring visible). Tab twice → Serial port (ring visible). Escape closes; focus returns to the source button. OK.
- Known: no type-ahead in the popover (B1, test asserts it).

## Zoom (Q-5, report only)

WebDriver `Control+=`, `Control+-`, `Control+0` on the app window: the keydown reaches the page (listener logged `Ctrl+=`, `Ctrl+-`), but the webview does not zoom: `devicePixelRatio` 1, `innerWidth` 1440 and status-bar brand width 121.875 px unchanged after each step, `document.body` zoom 1. Zoom is not supported in this build. Consistent with Q-5 (not a requirement in 009; recorded as unsupported). Not tested with a human keyboard, only with injected keys.

## Findings (defects)

### BUG-1 (minor): plot tags typed in capitals by CSS

- **Summary:** `.ui-badge[data-variant='tag']` applies `text-transform: uppercase` to the whole text. The tag copy turns into `HOLD · LAST DATA 23:31:28` and `NO SOURCE CONNECTED`. The before build showed `HOLD · last data` and `No source connected`. Not an approved change.
- **Severity:** minor (visible, copy presentation; no information lost).
- **Steps to reproduce:** `npm run e2e:run -- --spec e2e/specs/visual.e2e.ts` (state `banner-device-lost-1440`, `narrow-1024-seeded`), or disconnect a source with the plot visible.
- **Expected:** DESIGN.md 2.8 typography table (plot tag: caps tracking for the state word, example `HOLD · last data 13:44:46`), 4 Badge `tag` variant (line ~782: caps for LIVE, CAPTURING, HOLD), 8 (sentence case; caps only through the caps style for group labels and section titles).
- **Actual:** the whole tag is capitals.
- **Evidence:** `screenshots/compare-banner-device-lost-1440.png`, `screenshots/compare-narrow-1024.png`, `screenshots/compare-menu-undo-toast-1440.png`; `evidence/after-final/banner-device-lost-1440.png`.
- **Suspected area:** `src/ui/Badge/Badge.css` (`[data-variant='tag']`, `text-transform: uppercase`); fix or PM decision to accept.

### BUG-2 (minor): popover row focus ring moved outside the row

- **Summary:** keyboard focus on a source-popover row draws its 2px ring outside the row box. Before it was inside. B1 says the popover "looks the same". Not in decisions.md.
- **Severity:** minor (focus stays visible; visual change only).
- **Steps to reproduce:** open the source popover with the keyboard (focus the source button, Enter, then ArrowDown or Tab).
- **Expected:** same ring as before (inside the row) or a ruling that moves it (DESIGN 9.8 and 5.1 are the reference).
- **Actual:** ring outside the row; visible in `screenshots/compare-menu-keyboard-focus-1440.png` (top: before, bottom: after) and `evidence/qa-kb/kb-popover-tab.png`.
- **Suspected area:** `src/ui/Popover/Popover.css` (focus ring of `.ui-list-row` / `ListRow`) and the outline offset.

### BUG-3 (minor, AC2 not met): non-token size and spacing literals in CSS

- **Summary:** the token guard covers colour, shadow, radius and z-index. Sizes and spacing are not guarded, so about 60 literals remain outside `tokens.css`: `src/styles/app.css` (33; `font-size: 11px` four times, which equals `--font-size-xs`; `gap: 6px`, `padding: 7px`, `padding-bottom: 6px`, `left: 76px`, `width: 330px`, `padding: 0 40px`, `font-size: 15px`), `src/components/source/source.css` (`outline: 2px`, `min-height: 17px`, `outline-offset: 1px` ok), `src/components/source/SourceDialog.css`, `src/ui/Button/Button.css` (12px icon slot), `src/ui/Menu/Menu.css` (`16px` glyph column).
- **Severity:** minor (no visible change found; contract and maintainability; AC2 and the DoD line "no non-token literal left in CSS" are not met).
- **Steps to reproduce:** `grep -rnE '[^a-z-][0-9]+(\.[0-9]+)?px' src --include=*.css | grep -v tokens.css | grep -v '1px\|0px'`.
- **Expected:** every size or spacing value is a token or a `calc()` of tokens (DESIGN 2.17), or a named geometry token pinned by a contract test; the guard should fail on them.
- **Actual:** literals present; guard does not check them.
- **Suspected area:** `src/styles/app.css`, `src/components/source/source.css`, `src/components/source/SourceDialog.css`, `src/ui/Button/Button.css`, `src/ui/Menu/Menu.css`; `src/styles/tokens.test.ts` (`literalViolations`).

## Residual risk

- Visual guard and e2e flake in the row-action reveal (`hover actions replace the badge`): 1 red in the full run, green alone. Earlier full runs of this work item also had reds in this area (QA memory: row-action click flake).
- Screenshot pairing defect in the visual spec (names vs real widths); a reviewer must use the PNG width.
- Reduced motion not exercised in a browser.
- Zoom unsupported (Q-5) and not tested with a human keyboard.
- Hardware (SA430) cases skipped in this run; the real-device visual shots are not in the after set.
- Repo state: nothing committed, `docs/images/*.png` modified (re-shot, not committed); `e2e/logs/` has the failure screenshot of the flaky test (git-ignored).

## Open items for the PM (not defects)

- ADR 0015 section 5 describes the removed `legacy-controls` layer (doc nit, AC6).
- DESIGN.md 14 / 12: F16 and F17 and the plot-tag rule need to match what ships (BUG-1 decides the tag rule).
- The old `docs/user-guide.md` wording "press Play" is updated (C1); the user guide re-shot images are in place.

## Re-verification (request 0237, after developer fixes 0236)

Date: 2026-11-17. Nothing committed. Build: `npx tauri build --debug --no-bundle` of the fixed working tree. Shots: `evidence/after-final-r3/` (simulator, 1440 and 1024 and 1180) and `evidence/after-final-r3-hw/` (real SA430 on `/dev/ttyACM0`). Composites: `screenshots/qa-r3-*.png`.

### Gates

| Check | Command | Result |
| --- | --- | --- |
| Quality gate | `npm run check` | **EXIT 0.** cargo fmt, clippy `-D warnings`, `cargo test --workspace` all ok, Prettier, ESLint, tsc (app and e2e), Vitest 52 files, 526 tests passed (was 519). Log: `/tmp/claude-1000/qa-check.log` |
| Full e2e (simulator, hardware skipped) | `PATH=<wkd>:$PATH SPECTRUM_E2E_SHOTS=evidence/after-final-r3 npm run e2e` | **EXIT 0.** 11 of 11 spec files passed. Visual 47 passing, 3 skipped (hardware). Log: `evidence/qa-r3-full-e2e.log` |
| Hardware visual (real SA430 attached) | `SPECTRUM_E2E_SA430=1 npm run e2e:run -- --spec e2e/specs/visual.e2e.ts` | **EXIT 0.** 49 passing, 1 skipped (needs two analyzers). Log: `evidence/qa-r3-hw-visual.log` |
| Hardware SA430 spec | `SPECTRUM_E2E_SA430=1 ... --spec e2e/specs/sa430.e2e.ts` | Run 1: **1 failing** ("renames it through Edit": Edit button not interactable, `clickRowAction` in `helpers.ts`). Isolated re-run of that test: **pass**. Full spec run 2: **8 passing**. Logs: `evidence/qa-r3-hw-sa430.log`, `qa-r3-hw-sa430-rerun.log`, `qa-r3-hw-sa430-run2.log`. Classified as the known row-action reveal flake (see Residual risk). |

### Shot names

`after-final-r3`: 118 PNGs, **0 name/width mismatches** (the r2 set had 12). `after-final-r3-hw`: 104 PNGs, 0 mismatches. The visual spec now waits for a stable `innerWidth`, so the shot names match the real widths. Confirmed with a PNG header check (`/tmp/claude-1000/qa-widthcheck.py`).

### Per bug

| Bug | Re-test | Result | Evidence |
| --- | --- | --- | --- |
| BUG-1 plot tags in capitals | Looked at the same states before and after: `plot-tag-waiting`, `banner-device-lost-1440`, `narrow-1024`, `toolbar-acquiring-60-1180` (LIVE tag), the SA430 Add dialog shot (HOLD tag). Guard test `Badge.test.tsx` (no `text-transform` on the tag, with a self-check). | **Fixed, closed.** "No source connected" is sentence case again, matching the pre-009 shot; "LIVE" and "Waiting for data..." are unchanged. "HOLD · last data 00:09:13" on hardware is sentence case. | `screenshots/qa-r3-tags-before-vs-after.png`; `evidence/after-final-r3/banner-device-lost-1440.png`; `evidence/after-final-r3-hw/add-dialog-ok-1180-sa430.png` |
| BUG-2 popover row focus ring outside the row | Fresh run `menu-keyboard-focus-1440` and the developer probes. Computed `outline-offset` is `-2px` (inside); the probe `bug2-probe-outside.json` (`1px`) was the bug build. Contract test `ListRow.test.tsx` (inside ring, with a self-check) and the visual spec's ring assertion (`-2px`). | **Fixed, closed.** The ring is fully inside the focused row on all four sides. Pre-009 the sides were clipped at the list edge (the developer's crop `evidence/qa-fixes/bug2-crop-before-left-vs-outside-right.png`); now they are complete. The look is close to pre-009 and not pixel-identical at the sides. I accept it as a visual difference, which the PM can confirm. | `screenshots/qa-r3-popover-focus-before-vs-after.png`; `evidence/after-final-r3/menu-keyboard-focus-1440.png` |
| BUG-3 px literals outside tokens (AC2) | (a) Scan of every CSS file under `src/` outside `tokens.css` for `px` in declarations: **0 hits** except in comments. Only `0`, `1px`, `-1px` remain (the documented hairlines, and `calc(1px + ...)` in the popover inset). (b) Guard `tokens.test.ts` "keeps pixel sizes and spacing out of CSS": covers padding, margin, gap, inset, top/right/bottom/left, width/height/min/max, grid templates, font-size, outline, border, with a self-check (`flags each kind of literal`). Fails on `padding: 7px`, `top: -2px`, `font-size: 11px`, `outline: 2px`. (c) Computed geometry, developer pre vs post (`qa-fixes/bug3-pre3` vs `bug3-post3`): `css-idle.json`, `css-idle-narrow.json` and `css-zoom.json`: **0 rect and 0 computed-value diffs** across 181 / 181 / 404 elements. The other state files differ only in the side panel's Peaks table (a 50px shift below it), which tracks the live peak count between the two captures. That is data, not CSS. | **Fixed, closed.** Pixel values did not change in the idle, narrow and zoom states; the live-panel difference is data. | `evidence/qa-fixes/bug3-pre3/`, `bug3-post3/`, guard in `src/styles/tokens.test.ts` |

### Spot checks of shots not reviewed before (fresh run, real widths)

| Shot (path) | Finding |
| --- | --- |
| `evidence/after-final-r3/panel-source-settings-1440-sim.png` | ok. Tone and Drifting carrier groups, field widths and units (dBFS, kHz, s) aligned, Enabled checkboxes teal (F16). Plot tag LIVE. |
| `evidence/after-final-r3/panel-measurement-1024-sim.png`, `panel-display-1440-sim.png` | Not individually re-opened; the side-panel section headings, the Peaks table alignment (Frequency, Level, Prom.) and the Reset/Max hold rows match `panel-peaks-rows-1440-sim.png` (opened: ok). |
| `evidence/after-final-r3/toolbar-acquiring-60-1180-seeded.png` (60-char name) | ok. Name ellipsised ("Sim Very long source name used t..."), full name in the title/aria-label as before; Continuous red Pause; Span value and the status bar `Uncalibrated` visible at 1180. |
| `evidence/after-final-r3/toolbar-connected-22-1024-seeded.png` (22-char name) | ok. "Simulated bench unit 2" whole; the Center and Span fields fit at 1024; the side panel scrolls, nothing clipped. |
| `evidence/after-final-r3/plot-zoom-reset-1440.png` | ok. The "Zoom: 1.6384 MHz · reset" tag is sentence case, as the design says. |
| `evidence/after-final-r3/plot-tag-waiting-1440.png` | ok. "Waiting for data..." unchanged from before. |
| `evidence/after-final-r3-hw/toolbar-acquiring-real-1024-sa430.png` | ok. Real device name in full: "SA430 08FF41E50F8B3A34", the status bar shows `Unit dBm` (the driver's calibrated unit; no `Uncalibrated`), Peaks "No peaks above the detection criteria." |
| `evidence/after-final-r3-hw/toolbar-connected-real-1180-sa430.png` | ok. Device name in full, Continuous (teal), "Stopped" tag. |

### Toolbar height (new observation, not a defect)

Compared with the T0 baseline (`evidence/before/capture-idle-continuous-1440.png`), the toolbar's bottom border moved from y=48 to y=44 at 1440 (PIL column scan), so the toolbar is 45px tall instead of 49px. The controls are 30px as in `--control-height`, and the padding is 7px. `screenshots/qa-r3-toolbar-1440-before-vs-after.png` shows the same controls with less space above and below. DESIGN.md 3.x (line 554) records this as the content height (45px). This follows from F1 (toolbar control height 30px, design.md line 215). It is not in the decisions list or the difference table I wrote before, so I list it here for the PM to confirm as part of F1. It does not block.

### Residual risk and open items (re-verification)

- **Row-action reveal flake:** this round, `sa430.e2e.ts` "renames it through Edit" failed once (Edit button not interactable, `clickRowAction` in `e2e/specs/helpers.ts`). It passed when run alone and in the next full run of the SA430 spec (8 of 8). Earlier QA saw the visual hover test ("hover actions replace the badge") fail once in a full run and pass on re-run. The developer's fix (wait for the row to settle before one hover) did not change that. This is a test-timing flake, not a product regression by the evidence, but it is not closed. Staff engineer to look at `clickRowAction` and `revealRowActions` in `e2e/specs/helpers.ts`.
- Reduced motion is still not exercised in a browser (WebKitGTK does not follow the setting).
- Ctrl+= and Ctrl+- do not zoom (Q-5), unchanged from the first QA report.
- The SA430 "mismatch" state (two analyzers) was not run (one device attached).

### Verdict (re-verification)

**SHIP.** All three bugs are fixed and I observed each fix (screenshots, computed style, and the guard tests with self-checks). The gates are green: `npm run check` (526 tests) and the full e2e (11 of 11 spec files), plus the hardware visual run (49 passing). The one open point is the SA430 row-action flake, which is known and is not a product regression by the evidence. The PM should confirm two visible items as accepted: the BUG-2 ring is now complete on the sides (close to pre-009), and the toolbar is 4px shorter under F1.
