# 013 developer notes: source button and capture control in the Measurement group (issue 40)

Status: implemented, not committed (branch feat/40-measurement-source-capture). Path: fast path.

## What changed

Layout
- `src/components/Toolbar.tsx`: brand only. The source group (`SourceButton`, `CaptureControl`) is gone.
- `src/components/panels/MeasurementPanel.tsx`: `<SourceButton />` is the first item, `<CaptureControl />` the last
  (after the FFT rows and the Max hold, Min hold, Reset row, or after Averaging when the processing settings are not
  known yet). Center, Span, FFT rows and the hold row are unchanged.
- `src/components/capture/CaptureControl.tsx`: `SplitButton` gets `fullWidth`.
- `src/ui/SplitButton/SplitButton.tsx` and `SplitButton.css`: new `fullWidth` prop (class `split-button-full`): the group
  is 100% wide, the main segment takes the room (`flex: 1 1 auto; width: auto`), the chevron keeps 26px. The default
  placement and the fixed segment widths are unchanged.
- `src/components/source/source.css`: `.source-control` and `.source-button` fill the column (no 150 to 280px bounds).
  `.source-control > .popover-source { width: 100% }`: the source popover is as wide as the button in the panel.
- `src/styles/app.css`: removed `.toolbar-group`, `.toolbar-source`; removed `gap` from `.toolbar` (brand only).
- `src/styles/tokens.css` (and DESIGN Appendix A, equal to it): removed `--source-name-min`, `--source-name-max`,
  `--toolbar-gap`, `--toolbar-group-gap` (and the narrow-window overrides of the last two). No other user.

Decisions
- Popover width in the panel = the source button width (305px at a 330px panel), not `--popover-width` (360px).
  Reason (measured): `.side-panel` is `overflow-y: auto`, so a wider popover is clipped on its left edge (its
  left side is outside the panel box, and overflow to the left is not scrollable). `align="end"` alone does not help
  (it still extends 360px to the left of a button at the panel's right edge).
- Capture menu (280px) is unchanged; it is right-aligned to the full-width chevron, so it stays inside the column.
- Portal or fixed positioning for the popovers was not done: it would change the dismiss/focus code of ui/Popover
  and ui/Menu for a case that a column-width popover already solves.
- Comments and test titles that said "toolbar" for these controls were changed (no behaviour change).

Docs
- `DESIGN.md`: 2.10 token rows; Appendix A (mirrors tokens.css); 3.1 heights; 3.2 width table and measured
  bullets (the old toolbar spare-width and overlap figures are removed, not re-measured); 3.3 rewritten as the
  brand-only toolbar; 3.6 Measurement order (source first, capture last) and a "popovers from the panel" rule;
  3.7 workspace height at 640px; 3.9 150%/200%/125% rows marked as measured before 040 (not re-measured); 4.3
  full-width variant and placement; 4.11 popover width in the panel and capture menu placement; 4.13 unchanged;
  5.1/5.8 wording; 5.9 shrink order and measurement; 9.8 focus order; 9.9 measured targets (source button 305 x 30,
  capture main 279 x 30); Q-5 premise and Q-6 wording. Not changed: the 9.3/9.4 contrast tables and the decision
  register (historical rows still mention the toolbar fields, as in 012).
- `docs/user-guide.md`: "Toolbar" section is now "Measurement group"; first-run step points at the panel.
- `docs/architecture.md`: diagram line (box width kept at 79 columns).
- `docs/testing.md`: visual guard description (source button fills the side panel column).

Tests (unit)
- `src/components/Toolbar.test.tsx`: brand only (no source button, capture or tuning fields); header landmark (B7).
- `src/components/panels/MeasurementPanel.test.tsx`: the source and capture tests moved from the Toolbar test
  (10 tests, same assertions, rendered by `MeasurementPanel`), plus: source button first and capture last; both full
  width (`split-button-full`, source control parent).
- `src/components/SidePanel.test.tsx`: Measurement group holds the source control first and the capture group last.
- `src/components/source/source.css.test.ts`: the width bounds test is now "fills the side panel column; popover as
  wide as the control" (no source-name tokens).
- `src/ui/SplitButton/SplitButton.test.tsx`: `fullWidth` class, CSS for the full-width main segment, chevron width
  unchanged, default has no full-width class.
- `src/ui/SplitButton/SplitButton.stories.tsx`: new story `FullWidth` (in a 330px column, `--panel-width`).

Tests (e2e)
- `e2e/specs/acquisition.e2e.ts`: the layout test now asserts the source button is the first item and the capture
  group the last of the Measurement group, and the toolbar holds neither (plus Center and Span not in the toolbar).
  New test: the source popover and the capture menu open fully inside the window and inside the panel's column,
  and Escape returns focus to the trigger (keyboard only). It pauses an acquisition that is running (the chevron is
  locked while acquiring) and resumes it at the end.
- `e2e/specs/visual.e2e.ts`: the width test asserts the source button equals the column width (was 150 to 280px);
  Tab loops allow 30 tab stops (the capture control is now further down the panel); the capture menu must also be
  inside the window vertically; shot names `toolbar-*` renamed `panel-*`; describe title updated.
- Comments only in `e2e/specs/helpers.ts`, `edit-source`, `add-source`, `source-row`.

## Results

- `npm run check`: EXIT 0 on the final tree (after the last e2e edit). Vitest 55 files, 710 tests passed. cargo fmt,
  clippy -D warnings, cargo test, Prettier, ESLint and tsc (app and e2e) passed. An earlier run failed on Prettier
  for a scratch file I had left in the work folder (deleted).
- E2E, built with `npx tauri build --debug --no-bundle` (WebKitWebDriver from the scratchpad copy on PATH):
  - `visual.e2e.ts`: 47 passing (1m 38s), including the source button column fit and the capture menu inside the window.
  - `acquisition.e2e.ts`: 19 passing (new test included), run alone after the last edit.
  - Full `npm run e2e` (run before the acquisition fix): 8 of 11 spec files passed (visual 47, acquisition except one test,
    persistence, sa430 (hardware cases skipped), source-row, status-bar, add-source, edit-source, migration-dup).
  - `failures.e2e.ts`: 2 passing, 1 failing when run alone: "reports a failed pick ... refused the connection" gets the
    SA430 "Device or resource busy" text instead. Environmental: `/dev/ttyACM0` is held by another running
    `spectrum-studio` process (PID 70673, `fuser -v /dev/ttyACM0`). Not reproduced as a regression; not verified on HEAD.
  - `migration.e2e.ts`: failed once in the full run (SA430 busy at that time), passes 3 of 3 when run alone.
- The acquisition failures in the full run were mine and are fixed: the new test ran while the simulator was still
  acquiring (the capture chevron is locked then), and the first fix (pausing without resuming) broke the tests after it.
  The test now pauses for its capture-menu check and resumes afterwards, so the following tests see the same state.

Measured in the real app (WebKitGTK, simulator, probe spec deleted afterwards)
- At 1440 x 900 and 1024 x 768: side panel 330px wide (content column 305px). Source button 305 x 30 at 65px from
  the top; Center 140 x 28 at its right edge; capture group 305 x 30 at y 315; main 279 x 30; chevron 26 x 30.
- A 60-character name: name box 238px, `scrollWidth` 352 (ellipsis). Brand 122 x 18, toolbar 33px tall.
- Source popover at 1440 and 1024: left 1123 / 707, right 1428 / 1012, top 99, bottom 556 (inside the window and
  the panel).
- Capture menu: 280 px wide, right at the chevron, top 349, bottom 482 (inside the panel and the window).
- The side panel scrolls at 1024 x 768 (scrollHeight 798, clientHeight 711) with all sections open, as before.

## Open points and deviations

- Zoom (Q-5): the side panel is the narrow part now. Not re-measured at 150%/200% (DESIGN 3.9 rows are marked as
  measured before 040).
- The capture control is no longer always visible: at the bottom of a scrolled side panel (Source settings open, or
  the Peaks table grown) it can be scrolled out of view. Its state is still in the plot tag and the status bar. Worth a
  look by the designer; not changed here.
- Span still has its own focus notes from 012 (unchanged).
- The `toolbar-*` screenshot names in `visual.e2e.ts` were renamed `panel-*`; any old evidence keeps the old names.
- Storybook: only the `FullWidth` story was added. No other story referenced the toolbar.
- DESIGN 3.2/3.9 numbers at 150%/200% and the Q-5 zoom analysis need a fresh measurement in a later pass.
