# 012 developer handoff: Center and Span in the Measurement group (issue 38)

Status: implemented, not committed. Uncommitted on branch feat/38-measurement-center-span.

## What changed
- `src/components/panels/MeasurementPanel.tsx`: Center (`FrequencyField`, `data-testid="center-frequency"`) and
  Span (`Select`, `data-testid="span-select"`) are the first two `Field layout="inline"` rows, above FFT size.
  Limits, step (span/10), span option list (`—` with no source, non-listed current span), disabled conditions
  and title reasons are unchanged. Center and Span render with no status (disabled); FFT size, Window,
  Averaging and the hold row render only when `processing` is known (as before).
- `src/components/Toolbar.tsx`: brand and source group only.
- `src/ui/Field/Field.css`: inline frequency is `--field-width-inline` (130px) so Center matches the other panel
  rows (the frequency class defaults to 140px); removed the toolbar-frequency width rule.
- `src/ui/Field/FrequencyField.tsx`: size comment updated (height only).
- `src/styles/app.css`: removed `.toolbar-field` and `.toolbar-span`.
- `src/styles/tokens.css`, `src/styles/tokens.test.ts`: removed `--field-width-frequency` (both blocks) and
  `--toolbar-field-gap` (no longer used by any rule).
- `DESIGN.md`: 2.10 token rows and off-scale list, Appendix A (kept equal to tokens.css), 3.2 width table
  notes, 3.3 toolbar (brand + source group), 3.6 side panel (Measurement starts with Center, Span), 4.4 and 4.5
  variants, 9.8 focus order, 9.9 measured targets (marked for re-measure in the panel).
- e2e: `e2e/specs/acquisition.e2e.ts` new test "shows Center and Span first in the side panel Measurement group,
  not in the toolbar". `e2e/specs/visual.e2e.ts` comment only. Existing `input[aria-label="Center frequency"]`
  selectors still resolve.

## Tests
- `src/components/Toolbar.test.tsx`: Center/Span assertions moved out; new test "has no tuning fields".
- `src/components/panels/MeasurementPanel.test.tsx` (new, 9 tests): row order and inline layout; disabled with no
  source ("—"); typed Center commits via `applySourceSettings` with `spanHz: null`; out-of-range stays invalid and is
  not sent; Span pick sends `centerHz: null`; non-listed current span is listed; untunable source disables
  Center with its reason; fixed-span source disables Span with its reason; `busy === 'applying'` disables both.
- Storybook: no story referenced the toolbar fields; nothing changed there. `FieldSize` `toolbar` is kept (TextField
  story and FrequencyField test still use it).

## Checks
- `npm run check`: EXIT 0. Vitest 55 files, 690 tests passed. cargo fmt, clippy -D warnings, cargo test, Prettier,
  ESLint, tsc all green. (One earlier run failed on an ESLint `no-unnecessary-type-assertion` in my test; fixed.)
- e2e (WebKitWebDriver extracted from the Ubuntu package into the scratchpad, no sudo; `tauri build --debug --no-bundle`
  before each run):
  - `acquisition.e2e.ts`: 16 passing.
  - `visual.e2e.ts`: 47 passing, including the toolbar fit tests at 1024 and 1180 and the side panel shots.
  - Screenshot checked: `e2e/logs/visual/panel-measurement-1440-sim.png` (Center, Span, FFT size, Window and
    Averaging share one 130px column) and `e2e/logs/visual/toolbar-connected-22-1024-seeded.png` (toolbar is brand plus
    source group only).
  - Not run: the rest of the e2e suite (sa430, persistence, status-bar, migration) because they need hardware or
    are outside this change. They use the `aria-label` selectors, which still resolve.

## Deviations and open points
- Center is 130px, not the 140px of the frequency class in a parameter form. The panel's controls are 130px, so
  I chose 130px and documented it (DESIGN 3.6, 4.4, 2.10).
- Center and Span are now 130px inline in the panel. The DESIGN 9.9 measured target values (150 x 28.2, 98 x 26)
  were measured in the toolbar and are marked for re-measure in the panel, not re-measured by me.
- DESIGN 3.2 spare-width numbers (489px, 115px, toolbar content end at 951/901) were measured before the move and are
  marked "to re-measure"; I did not re-measure them.
- Left alone: `.toolbar-group` and `--toolbar-group-gap` (still used by the source group); the `size="toolbar"` variant
  of `Select` and `FrequencyField` has no instance now (kept as a ui variant, DESIGN 4.5 says so).
- Decision register rows 2143 and 2154 (historical) still mention the toolbar fields; left unchanged on purpose.

## Fix pass (message 0273 and QA observations O1, O2, O4, 3.2 and 9.9)

Status: fixed, not committed. `npm run check` EXIT 0 (Vitest 55 files, 696 tests; cargo test; ESLint; tsc).

### Changes
- **BUG-012-QA-1 (Center clipped at 1 GHz+):** `--field-width-inline` 130px to 140px (`src/styles/tokens.css`, DESIGN 2.10 and
  Appendix A). The side panel's control column is now 140px for every inline control (Center, Span, FFT size, Window,
  Averaging keeps its 90px unit column), so the rows still share one width and the right edges align. The width matches
  `--field-width-param` (140px). The redundant `.ui-field--inline .ui-field__input--frequency` rule is removed
  (`src/ui/Field/Field.css`). Measured in the real app (simulator, WebKitGTK): Center, Span and FFT size each 140 x 28 at
  1440 and 1024; `5.999000000 GHz` has scrollWidth 138 = clientWidth 138.
- **O1 (Enter drops focus to BODY):** `FrequencyField` no longer blurs after a valid Enter. A probe showed focus still lost,
  because the commit sets `busy = 'applying'`, and MeasurementPanel disabled Center while applying; a natively disabled
  control drops focus in WebKit. Center is now `readOnly` while applying (the DESIGN 4.4 read-only state: value visible,
  opacity 0.75), not disabled; Span stays disabled while applying. `FrequencyField` gets a `readOnly` prop that also stops
  ArrowUp and ArrowDown stepping. The probe then reads `INPUT:Center frequency` after Enter.
- **O2 (0 Hz with no source):** `FrequencyField` `value` is `number | null`; `null` shows an em dash and is not invalid
  and not stepped. MeasurementPanel passes `centerHz ?? null`.
- **O4 (guard):** `visual.e2e.ts` side panel test sets Center to `5999M`, checks the field reads `5.999000000 GHz`, runs the
  overflow check (`assertCenterFits`, shared with `assertNameVisible`), takes `panel-center-ghz-<w>-sim.png`, and restores
  100 MHz. Screenshot checked at 1024: whole value visible, rows aligned.
- **3.2 and 9.9 (QA measurements):** the re-measure markers are gone. 3.2 has QA's toolbar spare widths (889.5 / 834.1 at
  1440; 492.5 / 437.1 at 1024). 9.9 has Center and Span at 140 x 28 and the FFT select at 140 x 28, measured by me after
  the fix. DESIGN 3.6, 4.4 updated for the 140px width, the em dash with no source, and Enter keeping focus.

### Tests
- `src/ui/Field/FrequencyField.test.tsx`: Enter keeps focus (valid entry and unchanged value); null value shows an em dash,
  is not invalid and does not step; a typed entry with a null value is still checked; read-only shows the value, does not
  step and keeps focus.
- `src/components/panels/MeasurementPanel.test.tsx`: no source shows `—` for Center (not `0 Hz`); while applying Center is
  read-only and Span is disabled (replaces "disables both fields").
- `e2e/specs/acquisition.e2e.ts`: the retune test asserts focus is in "Center frequency" after Enter.
- `e2e/specs/visual.e2e.ts`: the GHz Center check and the shared overflow helper (above).

### E2E
- `acquisition.e2e.ts`: 16 passing (after `npx tauri build --debug --no-bundle`).
- `visual.e2e.ts`: 47 passing (the 3 skipped are the hardware-only cases, as before).
- A throwaway probe spec (`dev012-probe.e2e.ts`) measured the geometry and focus; it is deleted.
- Not run: sa430, persistence, status-bar, migration and the other specs (not touched by this pass).

### Not fixed, for the PM (candidates)
- O1 also covers the Span select: picking an option while applying disables it, and WebKit drops focus the same way. The
  fix is the same (aria-disabled or a non-disabled busy state), but Span is a native select, so it is a separate change.
  I did not change Span.
- O3 (SA430 quantisation shown in the status strip) is unchanged.
- DESIGN 3.9 (text enlargement 150%, line ~671) still says "Toolbar broken today: the capture control overlapped the Center
  field (measured before 038 ... so re-measure)". Center is no longer in the toolbar, so the row is stale; it needs a fresh
  measurement, not changed here.
- Escape still blurs a frequency field (existing behaviour, DESIGN 9.8 is about focus never being lost); Escape is a
  revert, so it is not part of O1.

## Second fix pass (Span focus, DESIGN 3.9)

Status: fixed, not committed. `npm run check` EXIT 0 (Vitest 55 files, 699 tests; cargo, clippy, ESLint, tsc).

### Changes
- **Span keeps focus after a pick (O1 for Span):** `src/ui/Field/Select.tsx` gets a `readOnly` prop (DESIGN 4.4, 9.10).
  While read-only it sets `aria-readonly="true"`, is not natively disabled, and ignores picks in `onChange`. React restores
  the shown value. `src/ui/Field/Field.css`: `.ui-field__input[aria-readonly='true']` uses `--opacity-read-only` (the
  existing `[readonly]` rule only matches inputs). `src/components/panels/MeasurementPanel.tsx`: Span is
  `readOnly={busy === 'applying'}` and keeps only the source-based `disabled` (no source, fixed span).
- **DESIGN.md:** 4.5 Select states say Span is read-only (`aria-readonly`) while a pick applies, with focus kept (9.8).
- **DESIGN.md 3.9, 150% row:** the stale "toolbar broken, capture overlaps Center" text is replaced. It now says the old
  overlap no longer applies because Center and Span moved to the side panel in 038, and that it was not re-measured at this
  width. Support status unchanged (Unsupported, Q-5). No measurement was invented.
- Storybook: `SelectReadOnly` story added to `src/ui/Field/Field.stories.tsx` (Select has stories).

### Tests
- `src/ui/Field/Field.test.tsx`: Select read-only ignores a pick, keeps the value and focus, has `aria-readonly`; CSS rule
  for `[aria-readonly='true']` uses the read-only opacity.
- `src/components/panels/MeasurementPanel.test.tsx`: applying makes Center and Span read-only, not disabled (replaces the
  "disables Span" assertion); new test: a pick keeps focus on Span, and a second pick while applying is not sent.
- `e2e/specs/acquisition.e2e.ts`: new test "applies a picked span and keeps keyboard focus on Span" (1024000, then back to
  2048000). It is a separate `it` after the layout test, not an edit of that test, so the layout test stays a layout check.

### E2E
- Build: `npx tauri build --debug --no-bundle` (WebKitWebDriver from the scratchpad `wkd` copy on PATH).
- `acquisition.e2e.ts`: 17 passing (16 before, plus the new span test).
- `visual.e2e.ts`: 47 passing (3 hardware cases skipped, as before).
- Revert-proof: with Span restored to native `disabled` during applying, the full acquisition spec fails only the new test
  ("expect(received).toBe(expected)", focus not on Span). With the fix it passes. The fix was restored and the debug binary
  rebuilt after that check.

### Left alone
- Escape still blurs a frequency field (not part of this pass). SA430 quantisation (O3) unchanged.

### Candidates for the PM (not changed)
- DESIGN 3.2 (line ~571) still says "the capture control overlaps the field group" below about 780 CSS px. The toolbar no
  longer has a field group, so that sentence is stale in the same way as 3.9. Needs a fresh measurement before rewording.
- DESIGN 3.9, 200% row ("Toolbar broken today (measured)") was measured before 038 and was not in this change. Its
  wording may be stale too.

## Third fix pass (BUG-012-QA-2, DESIGN.md corrections; QA round 2, msg 0278)

Status: fixed, not committed. `npm run check` EXIT 0.

### BUG-012-QA-2 (Enter on a Source settings Hz parameter drops focus)
- Cause: `SourcePanel` passed `disabled={busy === 'applying'}` to `ParamForm`, and a natively disabled control drops
  focus in WebKit.
- Fix: `ParamForm` takes `readOnly` and passes it to every control; `SourcePanel` passes `readOnly={busy === 'applying'}`
  (no `disabled`). `SourceDialog` keeps `disabled` (its own busy state, not an apply).
  - `FrequencyField`, `NumberField`, `TextField`: native `readOnly` (`NumberField` also stops stepping; `FrequencyField`
    already did).
  - `Select`: `readOnly` already existed (`aria-readonly`, ignores picks).
  - `Checkbox`: new `readOnly` prop: `aria-readonly`, changes ignored, `.ui-checkbox--read-only` (`--opacity-read-only`).
    The native checkbox cannot be `readonly`; React restores the controlled `checked`.
- Stale-state note: nothing else in the ParamForm path passes `disabled` for applying.

### Tests
- `src/components/ParamForm.test.tsx`: read-only form (frequency, number, text, choice, bool): none disabled, readonly /
  aria-readonly set, bool click ignored, Enter keeps focus in the frequency field.
- `src/ui/Field/Field.test.tsx`: Checkbox read-only (enabled, aria-readonly, change ignored, class, opacity rule).
- `src/ui/Field/NumberField.test.tsx`: read-only is focusable, not stepped, not committed.
- `e2e/specs/acquisition.e2e.ts`: new test "applies a Source settings frequency and keeps keyboard focus in it": Tone 1
  `100.3M` + Enter, the peak table shows 100.30, `activeElement` is `#source-tone1Hz`, not disabled; restores 100.25M and
  closes Source settings.

### DESIGN.md corrections (QA round-2 measurements, qa.md "Measurements")
- 3.2: the "intact down to about 780 px" sentence is replaced: no toolbar overlap down to 465 CSS px; the capture control
  passes the window edge at about 427 CSS px.
- 3.9, 150% (683 px): toolbar fits; status bar drops Noise floor, Rate, Frame (keeps 7); panel intact.
- 3.9, 200% (512 px): toolbar fits; status bar keeps 5 items (drops FFT and Avg as well); panel intact.
- 3.9 note: the 683 and 512 rows are simulated (root CSS zoom at 1024 px, media queries not re-evaluated); webview zoom
  keys do nothing in this build (QA O7). Support status (Q-5, Unsupported) unchanged.
- Q-5 text: its "toolbar overlaps below about 780 CSS px" premise is replaced with the measured numbers (support unchanged).
- 4.4: new bullet "While a commit applies": read-only, not native-disabled, for Source settings parameters, Center and Span.
- Left as history: the review rows at about lines 2045 and 2118 (they describe the review's own measurement and are kept).

### E2E
- Build: `npx tauri build --debug --no-bundle` (WebKitWebDriver from the scratchpad copy on PATH).
- Run: `acquisition.e2e.ts`, `visual.e2e.ts`, `failures.e2e.ts` (the failures spec opens Source settings).

## Final pass (Q-5 row, read-only-then-editable test)

Status: done, not committed. `npm run check` EXIT 1, caused only by Prettier on two PM-owned probe files (see below).

- `DESIGN.md` Q-5 row: premise "toolbar second row below 780 px" replaced with the measured no-overlap down to 465 CSS px
  (clips at about 427); no second row proposed. Ctrl+=, Ctrl+Shift+=, Ctrl+0 recorded as doing nothing in this build (O7).
  Support status stays Unsupported.
- `src/components/panels/MeasurementPanel.test.tsx`: new test "makes Center and Span editable again once the apply
  finishes" (busy 'applying' → readonly / aria-readonly; busy null → editable, a typed Center applies).

### Check results
- `npm run check` EXIT 1: `format:check` fails on `e2e/specs/r3012-probe.e2e.ts` and `e2e/specs/r3012-probe2.e2e.ts`
  (PM-owned, not touched). Every other step run separately: cargo fmt 0, clippy `-D warnings` 0, `cargo test --workspace` 0,
  Prettier on the changed files 0, eslint 0, tsc (app and e2e) 0, vitest 55 files / 704 tests pass.
- e2e not run (per instruction).
