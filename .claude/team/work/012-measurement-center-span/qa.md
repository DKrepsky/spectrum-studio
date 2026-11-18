# 012 QA: Center frequency and Span in the Measurement group (issue 38)

Tested: uncommitted working tree on `feat/38-measurement-center-span` (QA did not change production code).
Real app: `target/debug/spectrum-studio` built with `npx tauri build --debug --no-bundle` on this tree.
Driver: WebKitWebDriver extracted from the Ubuntu package into the session scratchpad (no sudo).
Hardware: a TI SA430 (2047:0005) is attached on `/dev/ttyACM0` and was used for the real-device checks.

## Verdict

**Do not ship yet.** Four of the five acceptance criteria pass. The fifth (keyboard and labels) passes
for the criteria asked, with one pre-existing focus issue noted. The blocker is one defect: the Center
field crops values of 1 GHz and above (`5.999000000 GHz` loses the `z`) at 1024 and 1440 widths. It is
a minor defect and a regression at 1440, since the old toolbar field was 150 px wide. A narrow fix
(size or text) and a re-test should be enough; see BUG-012-QA-1.

## Results per acceptance criterion

| # | Criterion (issue 38) | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | Toolbar shows brand and source group only (no Center, no Span) at 1024 and 1440 | **PASS** | Probe: toolbar children `brand`, `toolbar-group toolbar-source`; `[data-testid=center-frequency]` and `[data-testid=span-select]` inside `.toolbar`: 0 at 1440 and 1024. Screenshots `screenshots/idle-nosource-1440.png`, `screenshots/idle-nosource-1024.png`, `screenshots/connected-live-1440-sim.png`, `screenshots/connected-live-1024-sim.png`, `screenshots/toolbar-60-idle-1024.png`. Visual spec toolbar tests pass (see Automated). |
| AC2 | Side panel Measurement: Center then Span are the first two rows, above FFT size, same inline layout | **PASS** | Measured rows (1440 and 1024): label order `Center, Span, FFT size, Window, Averaging`, then Max/Min hold row. Every control: `ui-field--inline`, width 130 px, height 28 px, left edge x=1298 (1440) / x=882 (1024), right edge 1428 / 1012. Labels at x=1123 (1440). Averaging is 90 px plus its `traces` unit suffix, as before. Screenshots `screenshots/idle-nosource-1440.png`, `screenshots/connected-live-1440-sim.png`, `screenshots/connected-live-1024-sim.png`; dev run `screenshots/e2e-raw-visual/panel-measurement-1440-sim.png` and `...-1024-sim.png` (looked at: aligned, nothing clipped). |
| AC3 | Connected tunable source: committing a Center or picking a Span applies it; plot and status strip update | **PASS** (simulator and real SA430) | Simulator: typed `101M` + Enter → status strip `Center 101.00000 MHz`, state stays Acquiring, axis ticks `100.25000 MHz 101.00000 MHz`. ArrowUp → `Center 101.20480 MHz` (step 204.8 kHz = span/10, input `101.204800 MHz`). Span select `1.024 MHz` → status `Span 1.024 MHz`, `RBW 375 Hz`, axis ticks `101.20480 MHz`, `1.024 MHz`. Real SA430 (paused, then Continuous): Center typed `433.92M` → field `433.920000 MHz`, status `Center 433.919 MHz`; Span 2 MHz → select `2000000`, status `Span 1.999 MHz` (device quantisation, see O3). Screenshots `screenshots/center-typed-101M-1440-sim.png`, `screenshots/center-arrow-up-1440-sim.png`, `screenshots/span-1024k-1440-sim.png`, `screenshots/sa430-center-433-1024-real.png`, `screenshots/sa430-span-2M-1024-real.png`. |
| AC4 | No source, untunable, fixed-span, or settings being applied: fields disabled with the same reasons as today | **PASS** for no source (real app). **Unit only** for untunable, fixed-span and applying. | No source (real app): Center and Span `disabled` true, Span shows `—`, no `title` (same as before: the toolbar had no reason for this state). Screenshot `screenshots/idle-nosource-1440.png`. Untunable, fixed-span: no such source exists in this build (simulator and SA430 are both tunable with span options), so not run in the app. Unit tests in `src/components/panels/MeasurementPanel.test.tsx` pass: `disables Center with the reason when the source cannot be tuned` (title "This source cannot be tuned"), `disables Span with the reason when the source has a fixed span` (title "This source has a fixed span"), `disables both fields while settings are being applied`. Applying state not observed in the real app (too brief). |
| AC5 | Keyboard reachable, labels announced (accessible names), DESIGN, unit and e2e reflect the new location | **PASS** (with O1) | Tab order from the source button: `acquire-button` → `capture-mode-button` → Measurement `summary` → `input[center-frequency]` ("Center frequency") → `select[span-select]` ("Span") → FFT size → Window → Averaging → … (probe output). Focus ring: on Tab, `:focus-visible` true, `outline: solid 2px rgb(90,169,255)`, offset 1px on both Center and Span. Screenshots `screenshots/focus-center-1440-sim.png`, `screenshots/focus-span-1440-sim.png` (blue ring visible). Accessible names: `aria-label` "Center frequency" and "Span"; visible labels "Center" and "Span" are contained in the names. Screen reader not run (no AT in this environment). DESIGN 3.2, 3.3, 3.6, 9.8, 9.9 updated (numbers corrected below). Unit and e2e tests reflect the new location (see Automated). |

## Defects

### BUG-012-QA-1 (minor, regression at 1440): Center cuts off values of 1 GHz and above

- **Steps:** connect the Signal simulator; in Measurement → Center type `5999M` and press Enter (or
  press ArrowUp from `5.9 GHz`). Look at the field at 1024 px and at 1440 px.
- **Expected:** the whole value `5.999000000 GHz` is shown (design 3.6, 4.4; "text overflow or cropping
  without deliberate truncation is a bug" in the QA checklist). The unit is visible.
- **Actual:** the value is right-aligned in a 130 px box. `scrollWidth` 132 > `clientWidth` 128 at both
  1024 and 1440 (`scrollLeft` 0). The `z` of `GHz` is cut off. Crop: `screenshots/center-6000M-1024-sim.png`
  (field at 870–1020 × 70–112, magnified: `GHz` clipped) and `screenshots/center-6000M-1440-sim.png`.
- **Why it is a regression at 1440:** DESIGN 9.9 (before this change) measured the toolbar Center at 150 px
  wide (the toolbar frequency width rule). The change narrows the field to 130 px (`--field-width-inline`).
  This is inferred from the old width and the CSS; HEAD was not rebuilt to confirm.
- **Scope:** values of 1 GHz and above only. Simulator range is 0–6 GHz, so it is reachable. SA430 ranges
  are 300–348, 389–464 and 779–928 MHz (`sa430` crate), so `NNN.000000 MHz` (14 characters) fits; the
  real device is not affected.
- **Suspected area:** `src/ui/Field/Field.css` (`.ui-field--inline .ui-field__input--frequency`,
  `--field-width-inline` 130 px) and `src/styles/tokens.css`. Options for the developer: a width that fits
  the 15-character GHz form, or a unit-aware display (e.g. fewer decimals above 1 GHz). The e2e guard
  (`visual.e2e.ts`, `assertNameVisible` Center check) only tests 100 MHz, so it did not catch this; add a
  GHz value to the guard.
- **Severity:** minor (value still applied and shown in the status strip; the unit is partly hidden).

## Observations (not defects of this change; for the PM to decide, candidate issues)

- **O1 (pre-existing, Low; a11y, DESIGN 9.8 "focus is never lost"):** after Enter commits a frequency,
  `FrequencyField` calls `blur()`, so keyboard focus goes to `BODY` (probe: `active= BODY` after
  `101M` + Enter). The same code was in the toolbar before this change. Candidate issue.
- **O2 (pre-existing, Low):** with no source, the disabled Center shows `0 Hz` (`value={source?.settings.centerHz ?? 0}`,
  unchanged from the toolbar). It reads like a real setting. Consider an empty value with `—` as Span does.
- **O3 (pre-existing, Low; device quantisation):** the SA430 field shows `433.920000 MHz` and the select
  `10 MHz`/`2 MHz`, while the status strip shows `Center 433.919 MHz`, `Span 9.997 MHz` (10 MHz) and
  `Span 1.999 MHz` (2 MHz). The field shows the requested value and the status the device's, which is
  unrounded; no bug in this change, but DESIGN 3.4 could say which value the strip shows.
- **O4 (test gap):** `visual.e2e.ts` guards the Center scrollWidth only at 100 MHz (see BUG-012-QA-1).
- **O5 (checked, no defect):** `--field-width-frequency` and `--toolbar-field-gap` are gone from `src/`,
  `e2e/` and DESIGN.md (grep: no hits), so no dangling token references remain.

## Measurements (for DESIGN correction)

Measured in the real app, CSS px, with `getBoundingClientRect`. Simulator and SA430 gave the same geometry.

| Item | 1440 | 1024 | DESIGN now says |
| --- | --- | --- | --- |
| Center field (panel) | 130 x 28 (x 1298–1428) | 130 x 28 (x 882–1012) | 9.9 says "150 x 28.2 in the toolbar; re-measure in the panel". Correct to **130 x 28** in the panel. Pass (24 x 24 required). |
| Span select (panel) | 130 x 28 | 130 x 28 | 9.9 says "98 x 26 in toolbar". Correct to **130 x 28**. Pass. |
| FFT size select (panel, reference) | 130 x 28 | 130 x 28 | 9.9 "side panel select 130 x 26": measured height is 28. Correct the table row. |
| Toolbar content end (source group, capture) | 538.5 (22-char name, source button 224.6 px) / 593.9 (60-char, button 280 px) | 523.5 / 578.9 | 3.2 says re-measure; use these. |
| Toolbar spare width (to the right padding) | **889.5** (22-char) / **834.1** (60-char) | **492.5** (22-char) / **437.1** (60-char) | 3.2: correct "spare width to re-measure" to these values. |
| Toolbar right padding | 12 px | 8 px | matches 3.2 (padding 12 / 8). |

The 9.9 Center figure of 150 px was the toolbar field; the new figure depends on the 130 px decision,
which is what BUG-012-QA-1 questions.

## Automated checks (run by QA)

- `npm run check`: **EXIT 0**. cargo fmt, clippy `-D warnings`, `cargo test --workspace` (228 passed,
  0 failed across all crates), Prettier, ESLint `--max-warnings 0`, tsc, Vitest **55 files, 690 tests passed**.
  Log: session scratchpad `qa-check.log`.
- `e2e/specs/acquisition.e2e.ts`: **16 passing**, EXIT 0. Includes the new test "shows Center and Span
  first in the side panel Measurement group, not in the toolbar". This run also passed the two tests that
  failed at HEAD in work 011 (`qa-known-failures-011`).
- `e2e/specs/visual.e2e.ts`: **47 passing, 3 skipped**, EXIT 0 (the skipped ones are the hardware-only
  cases that need `SPECTRUM_E2E_SA430=1` or two analyzers; the log names "shows the Different device
  warning"). Shots (dev-run copies, QA's run): `screenshots/e2e-raw-visual/`.
- Not run: `sa430.e2e.ts`, `persistence`, `status-bar`, `migration`, `add-source`, `edit-source`,
  `failures`, `source-row` specs (not affected by this change except the status strip, which is unchanged).
  Honest status: **not run**.
- Developer tests reviewed: `MeasurementPanel.test.tsx` asserts order, labels, values, applied payloads
  (`centerHz` with `spanHz: null`, `spanHz` with `centerHz: null`), invalid input not sent, disabled reasons.
  They assert behaviour, not just rendering. `Toolbar.test.tsx` now asserts the absence of the fields. The
  e2e addition checks DOM order inside the Measurement group and the absence of the testids in `.toolbar`.
  Gap: no test for a GHz-width value (BUG-012-QA-1).

## Regression areas checked

- Toolbar source button still ellipsises the 60-char name (`screenshots/toolbar-60-idle-1024.png`,
  `screenshots/e2e-raw-visual/toolbar-acquiring-60-1024-seeded.png`); toolbar does not overflow (docScrollW = winW).
- Status strip shows Center and Span (`Center 101.20480 MHz`, `Span 1.024 MHz`); unchanged.
- Capture control, source menu and banners are unchanged in the 1440 and 1024 shots.
- Plot axis follows the Center and Span changes (axis ticks above).
- Simulator and SA430 both connected and acquiring with the panel rows enabled.

## Environment notes and side effects

- Port 1420 was free; no other app was running at the end.
- The SA430 was used in an isolated config dir (fresh per spec run). The device was left at centre
  433.92 MHz and span 2 MHz during the last probe; the 100 MHz restore was rejected by the SA430 range
  (out of range is a correct rejection). The device's setting at launch was 433.92 MHz / 10 MHz.
- Probe specs (`e2e/specs/qa012-probe*.e2e.ts`, `qa012-toolbar.e2e.ts` and seed `e2e/fixtures/seed/qa012-toolbar/`)
  were written only for this run and deleted afterwards; `git status` shows no QA files in the repo.
- Screenshots are in `.claude/team/work/012-measurement-center-span/screenshots/` (QA probe shots) and
  `screenshots/e2e-raw-visual/` (visual spec shots from this QA run; looked at: panel measurement 1440 and 1024,
  toolbar 60-char 1024, status bar, capture states).

## Open items for the developer

1. BUG-012-QA-1: fix the GHz clipping in Center at 1024 and 1440; add a GHz case to the visual guard.
2. Correct DESIGN 9.9 (Center 130 x 28, Span 130 x 28, FFT select height 28) and 3.2 (spare widths above).
3. Re-test after the fix: the 1440 and 1024 shots of `5.999…` GHz and the visual guard.

---

# Re-test (round 2, after the developer's fix passes)

Tested: the same uncommitted tree (`feat/38-measurement-center-span`), after the fix pass and the second fix pass.
Build: `npx tauri build --debug --no-bundle` (EXIT 0, binary 01:43, newer than the last source edit). QA changed no
production code. Hardware: SA430 attached on `/dev/ttyACM0`, left at 433.92 MHz / 10 MHz (restored, see SA430 below).
Screenshot prefix `r2-` (work folder `screenshots/`). Probe specs were throwaway files in `e2e/specs/` and are deleted.

## Verdict (round 2)

**Ship, with one Low item open (BUG-012-QA-2) and two DESIGN.md corrections before merge.** BUG-012-QA-1 is fixed and
verified. The O1 focus fix works for Center and Span in the Measurement group. All five acceptance criteria pass in the
real app. The new Low defect is in Source settings (the same shared `FrequencyField` used by ParamForm), is pre-existing
(HEAD also blurred on a valid Enter there), and is outside issue 38's criteria. The DESIGN.md stale notes (3.2, 3.9)
still need the corrections listed under "Measurements" below; they are documentation, not behaviour.

## Re-test results per item

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| R1 | BUG-012-QA-1: Center shows `5.999000000 GHz` in full at 1440 and 1024 | **PASS** | Probe: Center value `5.999000000 GHz`, box 140 x 28, `scrollWidth 138 = clientWidth 138` at both widths (no clipping). Screenshots `r2-center-ghz-1440-sim.png` and `r2-center-ghz-1024-sim.png` (looked: whole value and `GHz` visible, caret after the z, nothing cut). E2E guard `r2-visual-panel-center-ghz-1024-sim.png` / `...-1440-sim.png` (looked, ok). |
| R2 | Panel rows aligned at 140 px | **PASS** | Center, Span, FFT size, Window, Averaging: all `x` 1288 to `right` 1428 at 1440; 872 to 1012 at 1024; height 28 each (Averaging 90 px + `traces`). Screenshots `r2-center-ghz-1440-sim.png`, `r2-visual-panel-measurement-1024-sim.png` (looked: aligned, nothing clipped). |
| R3 | Enter commit keeps focus on Center | **PASS** | `101M` + Enter: `document.activeElement` = "Center frequency", value `101.000000 MHz`, focus ring visible. Screenshot `r2-focus-after-enter-center-1440-sim.png` (looked). Same at 5.999 GHz (1024 probe: active "Center frequency"). E2E `acquisition.e2e.ts` retune test asserts it too. |
| R4 | Picking a Span keeps focus on Span (keyboard) | **PASS** | Simulator: Tab from Center lands on Span (focus ring, `r2-focus-span-after-arrowdown-1440-sim.png`, looked). ArrowDown on the closed select: Span 2.048 to 2.4 MHz applied (select value from backend status), `activeElement` still Span. Then Space, ArrowUp, Enter: value back to 2.048 MHz, focus still Span. (I did not capture whether the popup opened on Space; the end state and focus are observed.) SA430 (real): Tab to Span, ArrowUp 10 to 5 MHz, ArrowDown back to 10 MHz, focus stayed on Span each time. Screenshot `r2-sa430-center-span-10M-1440-real.png` (focus ring on Span, looked). E2E `acquisition.e2e.ts` "applies a picked span and keeps keyboard focus on Span": passing. |
| R5 | Read-only look while applying | **PASS (DOM), look not observable** | MutationObserver during a Span pick: Center got `readonly` and Span got `aria-readonly=true` for about 37 ms, then both cleared. No `focusout` during apply. The window is too short to see or screenshot; the visual look (opacity 0.75) is not verified by eye. |
| R6 | No source: Center `—`, Span `—`, both disabled | **PASS** | Probe: Center value `—`, `disabled=true`; Span `disabled=true`, selected text `—`; capture control disabled with title "Connect a source first". Screenshots `r2-nosource-1440.png` and `r2-nosource-1024.png` (looked: dashes readable at the dimmed disabled look, no `0 Hz`, no overflow). |
| R7 | Toolbar: brand + source group only, 1024 and 1440 | **PASS** | `.toolbar` children: `brand`, `toolbar-group toolbar-source` at both widths. Toolbar `scrollWidth = clientWidth` (no overflow). Brand right edge to source group left: 18 px at 1440 and 10 px at 1024. Screenshots `r2-center-ghz-1440-sim.png`, `r2-center-ghz-1024-sim.png`, `r2-visual-toolbar-connected-22-1024-seeded.png` (looked: full names, no clipping). Long names: `r2-visual-toolbar-acquiring-60-1024-seeded.png` ("Sim Very long source name used t..." with ellipsis, full name in the tooltip) and `r2-visual-toolbar-idle-60-1180-seeded.png` (ellipsis, looked, ok). |
| R8 | AC1 (toolbar has no Center/Span) | **PASS** | Same probe as R7. |
| R9 | AC2 (Measurement first rows Center, Span, then FFT size, same inline layout) | **PASS** | Row labels: `Center, Span, FFT size, Window, Averaging`; see R2. |
| R10 | AC3 (connected: commit or pick applies; plot and status update) | **PASS** | Simulator: Center 101 MHz applied, status strip `Center 101.00000 MHz`, span 2.4 MHz applied and shown in the strip. Source settings Hz (ParamForm, Tone 1 Frequency) `100.3M` applied: peak P1 moved to `100.30000 MHz` in the peak table. SA430: Center `433.92M` and Span picks apply (values stay as the device reports them; the strip is not shown while paused). |
| R11 | AC4 (disabled with the same reasons) | **PASS for no source (real app); PASS for applying (DOM); untunable and fixed-span: unit only** | No source: R6. Applying: R5 (read-only, not disabled). Untunable / fixed-span: no such source exists in this build, so not run in the app; covered by `MeasurementPanel.test.tsx` (assert the title reasons). |
| R12 | AC5 (keyboard reachable, labels announced, DESIGN/unit/e2e reflect the move) | **PASS** | Tab order and focus ring: R4. Accessible names: `aria-label` "Center frequency" and "Span". Screen reader not run (no AT here). Unit and e2e tests: `npm run check` and the e2e runs below. |
| R13 | Regression: Source settings Hz params (ParamForm) commit and behave | **PASS for commit and Escape; defect for focus (BUG-012-QA-2, Low)** | Tone 1 `100.3M` + Enter: value `100.300000 MHz`, plot peak P1 at 100.30000 MHz (backend applied). `-1M`: `aria-invalid=true`, not sent; Escape reverted to `100.300000 MHz`. A valid draft `150.5M` + Escape reverted to the committed value (focus to BODY: Escape blurs, as before). Tone 1 restored to `100.25M` (P1 back at 100.25000 MHz). Focus after the valid Enter: **lost** (see BUG-012-QA-2). |
| R14 | Regression: Escape revert on Center | **PASS** | Draft `200M` (typed) + Escape: value back to `100.000000 MHz`. Draft `7G` (invalid, `aria-invalid=true`) + Escape: back to `101.000000 MHz`, status strip unchanged. |
| R15 | Regression: Span pick still applies in the simulator and the SA430 | **PASS** | See R4 and R10. |
| R16 | `npm run check` | **PASS, EXIT 0** | cargo fmt, clippy `-D warnings`, `cargo test --workspace` (228 passed, 0 failed), Prettier, ESLint `--max-warnings 0`, tsc (app and e2e), Vitest 55 files, **699 tests passed**. Log: session scratchpad `r2-check.log`. |
| R17 | `e2e/specs/acquisition.e2e.ts` | **PASS, 17 passing (EXIT 0)** | Includes the layout test and "applies a picked span and keeps keyboard focus on Span". Log `r2-e2e-acq.log`. |
| R18 | `e2e/specs/visual.e2e.ts` | **PASS, 47 passing, 3 skipped (EXIT 0)** | The 3 skipped are the hardware-only cases (`SPECTRUM_E2E_SA430` / two analyzers), as before. Panel GHz guard at 1024 and 1440 passes. Log `r2-e2e-visual.log`. |
| R19 | SA430 left at the restore target | **PASS** | Ended at Center `433.920000 MHz`, Span `10 MHz` (the device's own values at connect; the Center and Span picks in the last probe did not change them). |

## Defects (round 2)

### BUG-012-QA-1 (was minor): Center cuts off values of 1 GHz and above
**Status: FIXED, verified** (R1). Re-test shots: `r2-center-ghz-1440-sim.png`, `r2-center-ghz-1024-sim.png`.

### BUG-012-QA-2 (new, Low): Enter on a Source settings Hz parameter drops keyboard focus
- **Where:** `src/components/ParamForm.tsx` (`ParamField`, the Hz branch) passes `disabled={disabled}`, and
  `SourcePanel` sets `disabled={busy === 'applying'}`. The fix pass made `FrequencyField` keep focus after a valid Enter,
  but a natively disabled input drops focus in WebKit, so ParamForm's Hz field loses focus anyway.
- **Observed (MutationObserver on `#source-tone1Hz`):** `disabled=true, foc=true` (applying), then `focusout`, then
  `disabled=false, foc=false`. After Enter: `document.activeElement` = BODY. Screenshot `r2-paramform-focus-after-enter-1440-sim.png`
  (the field shows the value and a caret, but no focus ring; the DOM says the field is not focused, so trust the DOM).
- **Not a regression:** HEAD also blurred on a valid Enter. But the `FrequencyField` comment ("Focus stays in the field
  after a commit, DESIGN.md 9.8") is not true for this user, and the same native-disable pattern applies to the other
  Source settings controls (NumberField, Select, Checkbox) while applying.
- **Expected:** focus stays on the field after Enter (DESIGN 9.8), as Center and Span do now.
- **Suspected fix:** pass `readOnly={disabled}` (busy) for the Hz branch, as `MeasurementPanel` does; then decide the
  same for the other ParamForm controls (candidate issue for the PM, not part of 038).
- **Severity:** Low (a11y, DESIGN 9.8; no wrong value, no crash).

## Observations (round 2; for the PM, not defects of this change)

- **O6, WebDriver artefact:** batch key sends drop the second of two identical characters (`2 0 0 M` gave `20M` 5 of 5
  times; `1 0 0 . 3 M` gave `10.3M`). The same text typed with 120 to 150 ms gaps, or with `addValue`, gave the right
  value (`200M`, `5999M`). Not reproduced at human pace, so not a product defect; noted so nobody chases it.
- **O7, zoom shortcuts do nothing in this build:** Ctrl+=, Ctrl+Shift+= and Ctrl+0 leave `window.innerWidth` at 1024
  (12 presses). So the webview does not zoom from the keyboard here (DESIGN Q-5: unsupported, confirmed).
- **O8, Escape blurs a frequency field** (pre-existing; Escape is a revert). Focus goes to BODY after Escape. Not in
  scope for 038; DESIGN 9.8 says focus is never lost, so the PM decides whether Escape should keep focus.
- **O9, Span read-only is short:** about 37 ms in the simulator; the look while applying cannot be checked by eye.

## Measurements (numbers only, for DESIGN.md corrections)

**Method.** Real app (WebKitGTK). Webview zoom keys do nothing (O7), so the "text enlargement" rows were measured by
setting `document.documentElement.style.zoom` to 1.2 to 2.4 at a 1024 px window. The layout viewport is then
`1024 / zoom` CSS px (512 at 2.0, 683 at 1.5). The CSS media queries are NOT re-evaluated (they still see 1024 px); the
only breakpoint is 1180 px, which already applies at 1024. This is a simulation, not a true webview zoom.

**Toolbar (brand + source group + capture control), 22-character name, simulator:**

| Layout viewport (CSS px) | Zoom | Toolbar contents |
| --- | --- | --- |
| 1024 | 1.0 | Fits. Brand to source gap 10 px. |
| 853 | 1.2 | Fits. Element scan: 1 px scroll rounding on toolbar boxes, nothing past its content edge. |
| 819 | 1.25 | Fits. Same 1 px rounding; nothing past its content edge. |
| 769 | 1.33 | Fits. Same 1 px rounding on the source control. |
| 683 | 1.5 | Fits. No overlap; source name truncated with an ellipsis (intended). |
| 602 | 1.7 | Fits. |
| 512 | 2.0 | Fits. Brand to source gap 20 px (zoomed). Capture control inside the window. |
| 465 | 2.2 | Fits (no element past the window edge). |
| **427** | **2.4** | **Clipped (past the window edge):** the capture split button ends at x = 1077 px, past the 1024 px window (the chevron is off-window); the source group content (309 px) overflows its box (279 px). |

So the toolbar contents **do not overlap** at any width tested, and they **clip between 465 and 427 CSS px** (the
threshold is between 2.2 and 2.4 zoom). The 1 px rounding flags at 1.2 to 1.33 are not clipping. Within the range the app can reach (1024 down to 512 CSS px), nothing overlaps or
clips. DESIGN 3.2's "intact down to about 780 CSS px ... overlaps the field group" is stale: there is no field group.

**Status bar (items drop out, not cut; `statusBarOverflowX` = false at every step):**

| CSS px | Items shown |
| --- | --- |
| 1024 | Center, Span, RBW, FFT, Avg, Noise floor, Unit, Rate, Frame, Uncalibrated (10) |
| 683 (150%) | Center, Span, RBW, FFT, Avg, Unit, Uncalibrated (7; Noise floor, Rate, Frame dropped) |
| 512 (200%) | Center, Span, RBW, Unit, Uncalibrated (5; FFT, Avg also dropped) |
| 427 (240%) | Center, Span, Unit, Uncalibrated (4) |

**Side panel:** no row label overlaps its control at any width tested. At 1.2 to 1.33 the element scan reports 1 to 2 px
scroll-width rounding on rows and selects (`scrollWidth - clientWidth`), with every element still inside its container's
content edge; the same flags are not seen at 1.5 or 2.0 for rows. Not confirmed as visible clipping (not inspected by eye at those
zooms); not claimed as a defect. The status bar flag seen at 1.2 and 1.25 was not reproduced in the element scan.

**Screenshots of the enlargement states:** `r2-zoomcss-150-1024-sim.png` (683 CSS px: toolbar fits, panel rows intact,
status bar 7 items) and `r2-zoomcss-200-1024-sim.png` (512 CSS px: toolbar fits, panel rows intact, status bar 5 items,
plot narrow). Both looked at.

**DESIGN.md corrections (numbers):**
- 3.2, sentence "The toolbar is intact down to about 780 CSS px ... overlaps the field group": replace with the
  toolbar row above (no overlap down to 427 CSS px; the capture control runs past the window edge between 465 and 427 CSS px; simulated by zoom).
- 3.9, 150% row (683 px): toolbar fits; status bar drops three items (Noise floor, Rate, Frame); panel intact.
- 3.9, 200% row (512 px): the text "Toolbar broken today (measured)" is no longer true; toolbar fits; status bar drops
  FFT and Avg as well (5 items). Mark as simulated (root zoom), not webview zoom.
- 3.9 note "whether the webview responds to the zoom shortcuts": answered for this build: no (O7).

## Environment and side effects (round 2)

- Port 1420 free before the runs; no app left running at the end (the last probes closed with their sessions).
- Probe specs `e2e/specs/r2012-probe*.e2e.ts` written for this round and deleted; `git status --short e2e/` shows only
  the developer's changes (`acquisition.e2e.ts`, `visual.e2e.ts`).
- Screenshots: `screenshots/r2-*.png` (probe shots and copies of the visual-guard shots from this run, named
  `r2-visual-<name>.png`). Visual-run originals are in `e2e/logs/visual/` (git-ignored).
- Not run: `sa430.e2e.ts`, `persistence`, `status-bar`, `migration`, `add-source`, `edit-source`, `failures` and
  `source-row` specs (not affected by these passes except the status strip; unchanged).

## Open items

1. BUG-012-QA-2 (Low): developer, optional for 038; candidate issue for the PM.
2. DESIGN.md corrections: 3.2 sentence, 3.9 rows 150% and 200% (numbers above).
3. Visual look during apply (R5) cannot be checked: candidate note only.
