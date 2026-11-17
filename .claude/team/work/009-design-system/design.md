# 009 Design system: fix list, behaviour changes and inventory

Designer deliverable 2 of 3 (see the story). Companion: `/DESIGN.md` (the system, version 1.0-draft.2,
2026-11-16) and `prototype/index.html` (current against proposed, measured in the browser from the real CSS).
Status: for the design gate. The human reviewed draft 1 (review r1) and this file answers it. Nothing here
is approved until the human says so; each item carries a status.

Measurement tools for QA are in `measure/`: `build_harness.py` (builds a page from the real `src/styles/*.css`
and the toolbar, status bar and side panel markup) and `contrast_pairs.py` (the contrast table of DESIGN.md 9.3
and 9.4). Fonts on the test machine are fallbacks (Ubuntu, DejaVu Sans Mono); QA re-measures in WebKitGTK.

---

## 1. What changed in this revision

- **Corrections of fact.** `Uncalibrated` is hidden from 1024 to 1257px, including 1180px (draft 1 said it was
  visible at 1180px: wrong). The toolbar overlaps below about 780 CSS px. Several targets fail that draft 1
  passed (zoom reset 21.4px, checkbox label 19px). The field boundary fails 3:1 (1.27 to 1.39:1).
- **Disabled opacity.** Draft 1 proposed 0.45 for all disabled controls. At 0.45 the label is 3.48:1 on the
  control fill. Proposed now: 0.6 for every unavailable control (5.00:1). Decision Q-3. (F9 changed.)
- **Source selector.** A popover with list semantics, not a menu (review 1). That is behaviour change B1.
- **Live regions.** `role="alert"` only for unexpected failures (device lost, acquisition stopped, internal).
  Everything else is polite (review 1). That is B2.
- **Large text** is 24px regular or 18.67px bold (draft 1 said 15px semibold: wrong). Every text rule is 4.5:1.
- **Scrim token** `rgba(0,0,0,0.5 / 0.6)` removed. Scrims and shadows are separate tokens with explicit values.
- **New specifications** for the spectrum (DESIGN.md 6), performance and measurement integrity (7), the
  source lifecycle (5.2), readout selection (5.3), tooltips and the other patterns (5.4, 5.5), responsive ranges
  measured in the browser (3.2, 3.4, 3.9), the token architecture with a normative token file (2.18, Appendix A),
  the decision register and open questions (12).
- **New fixes** F13 (zoom reset target), F14 (checkbox label target), F15 (field boundary 3:1).
- **F0** rewritten with measured thresholds (section 4).

---

## 2. Fix list (visual and token fixes)

Status after work 009: F0 to F15 are accepted by the PM (`decisions.md`) and implemented; F16 and F17 were added in build review. The Status column below is the review state of 2026-11-16 and is not updated here; `DESIGN.md` section 12.1 has the current status.

Status key as in DESIGN.md 0.3. "Requirement" means the rule is approved; the value or the visual change is
the proposal. "No visual change" means the fix is a token or a name only.

| ID | Fix | Status | Visible change | Measured (today, then proposed) |
| --- | --- | --- | --- | --- |
| F0 | Status bar: whole-item removal, `Uncalibrated` always visible (section 4) | Bug candidate; mechanism Proposed; decision Q-1, Q-4 | Yes, at 1024 to 1257px | `Uncalibrated` cut at 1024 to 1257px; 10 items need 1258px |
| F1 | Field heights: toolbar Center and Span to 30px; side-panel selects to 28px | Proposed | Yes, a 1 to 4px step | Center 28.2, Span 26, side select 26 (number input 28.2). Then 30, 30, 28. |
| F2 | Small, icon and row-action buttons at 24px | Requirement (WCAG 2.5.8) approved; value Proposed; row-action placement ruled 2026-11-16 (note below) | Yes, 2 to 4px; row actions move to the row's centre line on hover or focus | `button.small` 22.8; marker × 23 x 20; notice dismiss 22.5 x 20; row actions 20. Then 24 x 24, centred in the badge column of a 44px row. |
| F3 | Menu headings line up with the glyph column (9px inset) | Proposed | 3px move | Heading 13px, glyph 16px. Then 16px. |
| F4 | Mode menu focus ring outside, offset 1px (token `--focus-ring-offset`) | Proposed | Keyboard focus only | Offset -2px. Then 1px. |
| F5 | Status bar text 11px (no 11.5px step) | Proposed | Yes, narrower text | 11.5px. Then 11px. |
| F6 | Dialog help text 12px | Proposed | Yes, dialog text | 11px. Then 12px. |
| F7 | Dialog field labels 13px | Proposed | Yes, dialog labels | 12px. Then 13px. |
| F8 | Inline connect-form error 12px | Proposed | Yes, error text | 13px. Then 12px. |
| F9 | One unavailable opacity, 0.6 (buttons, fields, rows, locked chevron); read-only stays 0.75 | Proposed; decision Q-3 | Yes, disabled controls are lighter | Buttons 0.45, inputs 0.5, chevron 0.55. Then 0.6. Label contrast 3.48 to 5.00:1 on the control fill. |
| F10 | Amber banner tint 12% (`rgba(255,181,71,0.12)`) | Proposed | Yes, banner tint | 10%. Then 12%. |
| F11 | Dialog group legend with no side padding | Proposed | Yes, 4px | Legend 4px right of its label. Then 0. |
| F12 | Remove the unused `--warn-strong` | Proposed (no visual change) | No | Defined, unused. |
| F13 | Zoom reset button at least 24px tall | Requirement approved; value Proposed | Yes, 2.6px | 124.8 x 21.4. Then min-height 24. |
| F14 | Checkbox label at least 24px tall (the label is the target) | Requirement approved; value Proposed | Yes, 5px | 79.1 x 19. Then 24. |
| F15 | Text field, number field and select boundary 3:1 (`--color-border-input` #5b6f8f) | Requirement approved (WCAG 1.4.11); value Proposed | Yes, input borders are lighter | #26344a: 1.39:1 on the panel, 1.27:1 on raised. Then 3.43:1 and 3.13:1. |
| F16 | Checkbox accent: `--color-accent` (teal) instead of the WebKit default blue | Accepted by PM (T6); implemented | Yes, checkbox colour | WebKit default blue. Then teal. |
| F17 | Center and Span value text in the primary colour (DESIGN 4.4) | Accepted by PM (T7); implemented | Yes, value text colour | Not the primary colour (inherited input colour). Then primary. |

Notes on the list:

- **F2, row actions: ruling 2026-11-16 (T9 review).** The earlier card said the 24px row actions fit inside the 44px row. That holds only with the actions centred in the badge column. The T9 build put them under the badge on line 2 and raised the row to 52px. Measured in the browser (real CSS, fallback fonts, 24px actions, row-relative): bottom-anchored under the badge, the actions overlap the badge pill by 4.2px at 44px, 2.1px at 48px, and 0.09px at 52px (touching, and it moves with the name's line box). Ruling: **keep 44px** (`--row-height` back to 44px in `tokens.css` and Appendix A); the actions are 24 x 24 and centred vertically in the badge column (top `calc(50% - 12px)`); they show on hover or focus, and the badge fades out while they show (replaced, not covered). Centred at 44px, the actions span 10 to 34px of the row; line 2 is not touched. Visible change: none at rest; on hover or focus the actions move up to the row's centre line. The spacing exception is not used: the select button's box lies under the actions. Follow-up for the PM: `Popover.css`, `ListRow.test.tsx` and the visual e2e test (DESIGN.md 13.4). Fixed blocks keep no visible heading in 009 (DESIGN.md 4.11).

- **F9 changed from draft 1.** Draft 1 proposed 0.45. The review asked for the disabled values to be revisited;
  0.45 fails the legibility goal for labels. 0.6 is the lowest value, in steps of 0.05, at which the primary label
  reaches 4.5:1 on the control fill. Q-3 asks the human to choose.
- **F1, F2, F4 are the fixes the designer would not drop** (as in draft 1): they are alignment or target fixes.
  F13, F14 and F15 are the accessibility fixes added by the review.
- **F15 does not change buttons.** A button's label identifies it (DESIGN.md 9.4 rule 3). Only fields and selects
  are in the list.
- **F10 and F12** are unchanged from draft 1.

Prototype: the F9, F13, F14, F15 and F0 cards are new or changed, with measurements. The Components and Screens
views use the proposed values where they are labelled "proposed".

---

## 3. Behaviour changes (not visual): for the PM to scope

These change what assistive technology hears, what the keyboard does, or what the app does. The story says
"pure refactor of behaviour"; each change below is therefore a scope decision. The designer's recommendation is
in the last column.

| ID | Change | Review item | Visible? | Files (for the staff engineer) | Recommendation |
| --- | --- | --- | --- | --- | --- |
| B1 | Source selector: `role="dialog"` popover with lists and ordinary buttons (not `role="menu"`); row actions are buttons, not `menuitem`; `aria-current` on the active row; Tab and Shift+Tab leave the popover and close it (no trap, no return to the trigger); Up and Down between rows; type-ahead removed (Q-18) | Review 1, menus and popovers | Keyboard behaviour only; looks the same | `SourceMenu.tsx`, `SourceButton.tsx`, `useMenuKeys.ts`, `SourceForm.tsx`, `SourceMenu.test.tsx` | **In 009.** Required by the review; needs the human's answer on type-ahead (Q-18). Largest item. |
| B2 | Live-region policy: `role="alert"` only for DeviceLost, AcquisitionFailed, Internal; connect failure, command errors, test results, form errors polite; the live container always in the DOM | Review 1, announcements | None visually | `NoticeBanner.tsx`, `SourceForm.tsx`, `SourceDialog.tsx`, `CaptureControl.tsx` (already polite) | **In 009.** Small. Approve Q-17 first. |
| B3 | Start-up states: "Loading…" until the first status and list arrive; "Status unavailable" when the start-up command fails; no "Choose a source" as a default | Review 2 (state ownership) | Yes, text at start-up only | `SourceButton.tsx`, `Toolbar.tsx`, `session.ts` (status null) | Separate bug or small 009 item. Needs a small store flag. |
| B4 | Readout tables: the id cell (`M1`, `P1`) is a keyboard button; a selected peak is cleared when it is no longer in the frame | Review 2, readout table | Focus ring on the id; the selection clears | `MarkersPanel.tsx`, `PeaksPanel.tsx`, `view.ts` | Separate work item (keyboard use of data tables). Not needed for the design system. |
| B5 | Peak table body capped at eight rows with its own scroll | Review 4, layout shift | Yes, the table scrolls after eight rows | `PeaksPanel.tsx`, `app.css` | Separate. |
| B6 | Notice stack capped at 96px, scrolls inside | Review 5, responsive | Yes, only with several notices | `App.tsx`, `app.css` | Separate; Q-20. |
| B7 | ARIA clean-up: remove `role="toolbar"` from the toolbar (no roving focus exists); the capture main and chevron describe their reason with `aria-describedby` | Review 1, names and roles | None visually | `Toolbar.tsx`, `CaptureControl.tsx` | **In 009.** Tiny. |
| B8 | Connecting and disconnecting: the plot tag and the status bar say "Connecting…" / "Disconnecting…" (today "No source connected") | Review 7, consistency (bug) | Yes, words only | `liveness.ts`, `StatusBar.tsx`, `SpectrumView.tsx` (hint) | Separate bug (PM). Tiny. |

Other behaviour the review asked about, which stays as it is today and is documented as Implemented or Open:

- **Switching source while acquiring** stops the acquisition and clears the trace, with no notice. Open, Q-22.
  The designer recommends that other rows are unavailable while acquiring, with the reason shown.
- **Peak click also places the active marker.** Implemented; split proposed, Q-7.
- **Connect has no cancel.** Deferred, Q-12.
- **Stale threshold of 2 seconds** is wrong for slow sweeps. Open, Q-11; bug candidate.

---

## 4. Finding F0 (not a small fix): the status bar cuts "Uncalibrated"

- **Measured** (real CSS, fallback fonts, all 10 items with the sample values in `build_harness.py`):
  - all 10 items fit at 1258px and above;
  - at 1257px and below, `Uncalibrated` is cut: its right edge stays at 1246px while the bar's edge moves in (1168px at 1180px);
  - without `Frame`, `Uncalibrated` is visible from 1078px;
  - without `Frame` and `Rate`, it is visible at 1024px (8 items, 65px spare);
  - the bar is 25px tall.
- **Draft 1 said** `Uncalibrated` was visible at 1180px and at 1440px. The 1180px claim was wrong; at 1180px the
  bar cuts it today. 1440px is correct.
- **Why it matters.** CLAUDE.md: uncalibrated data must never look calibrated. At every width from 1024 to 1257px
  the only place the UI says "Uncalibrated" is outside the bar. The unit (`dBFS`) is still shown, which is correct,
  but the calibration state is not.
- **Proposal** (DESIGN.md 3.4): remove whole items in this order, first removed first: Frame, Rate, Noise floor,
  FFT, Avg, RBW. Never removed: Center, Span, Unit, `Uncalibrated`. Never cut. Q-4 asks the human to confirm the order.
- **Mechanism** (Proposed): the status bar measures its items and removes them until the rest fit (a presentational
  `ResizeObserver`, no IPC). CSS fallback for fixed windows: hide Frame below 1280px and Rate below 1100px. The
  thresholds above have no margin, so the fallback adds about 20px.
- **Decision** (Q-1): accept, and track as a bug for the PM. It should not wait for the token work. A regression
  test should check that `Uncalibrated` is in the bar at 1024px, 1180px and 1257px.
- **Alternatives:** a second status line for diagnostics (more space, more chrome); a fixed second row below 1258px.
  Neither is recommended.

---

## 5. Copy findings (for the PM)

- **C1. "Play" in copy.** The status bar and the plot hints say "press Play"; the button shows the mode name. Target:
  "press Continuous" / "press Single". Decision Q-2 (DESIGN.md 8.2).
- **C2. The user guide is out of step.** `docs/user-guide.md` says "Play button" and describes the capture control as
  before work 006 in places. Owner: PM (docs).
- **C3. The docs screenshot is stale.** `docs/images/main-window.png` shows Stop, the SIMULATED tag and Export CSV.
  None of these is in the current UI. Re-shoot after the fixes (PM, docs).
- **C4. "No source connected" while connecting.** The plot tag and the status bar say this while the state is
  connecting or disconnecting. It is wrong; proposed copy is in B8.
- **C5. "Choose a source" before the backend answers.** Shown at start-up for a moment. Proposed copy is in B3.

---

## 6. Engineering items (for the staff engineer)

Detail in DESIGN.md 12.3. Summary:

- **E1.** The token file (`src/styles/tokens.css`) is the single source. Appendix A is its content. Tests enforce
  DESIGN.md 2.18 (variables defined, no literals, contrast, canvas map).
- **E2.** `--color-trace-min-hold` and `--color-focus-ring` are their own tokens (values unchanged).
- **E3.** `src/plot/theme.ts` reads its colours from the token file at runtime (Appendix B). Scope is Q-16: the
  story excludes canvas rendering internals, but review item 6 asks for this. Recommendation: in 009, token read only.
- **E4.** The contract tests (`capture.css.test.ts`, `source.css.test.ts`) read geometry by token name in the same
  change.
- **E5.** One heading style, one popover surface, one `StatusDot`; remove the duplicate `.waterfall-axis` rule.
- **E6.** The status bar mechanism (F0) and its 1024px regression test.
- **E7.** The live-region container and the popover semantics (B1, B2, B7) in the files listed in section 3.

---

## 7. Inventory of hard-coded values (today)

Counts from the files in this tree. The mapping to tokens is DESIGN.md 2.19 and Appendix A.

### 7.1 Colours outside the `:root` block

| Value | Where | Target token |
| --- | --- | --- |
| `#062018` (primary text, continuous chevron) | `app.css`, `capture.css` | `--color-text-on-accent` |
| `rgba(8, 12, 18, 0.8)` | `app.css` (`.plot-badge`, `.plot-zoom-reset`) | `--color-scrim-chip` |
| `#3a4d6b`, `#25344c` | `app.css` (`button:hover`) | `--color-border-hover`, `--color-surface-control-hover` |
| `#ffd166`, `#ff9f43`, `#ff6bcb` | `app.css` (peak, legend, marker ids) | `--color-peak`, `--color-trace-max-hold`, `--color-marker` |
| `#5aa9ff` | `app.css` (swatch), `--info` | `--color-trace-min-hold` (own token), `--color-info` |
| `#0b1018`, `#3ee0b5` | `app.css` `:root` (aliases) | Surfaces and accent |
| `#120a24` | `app.css` (`--danger-ink`, `--single-ink`) | `--color-text-on-danger`, `--color-text-on-violet` |
| `rgba(255, 181, 71, 0.1)` | `app.css` (`.notice`) | `--color-tint-warn` (12%, F10) |
| `rgba(255, 107, 107, 0.12)` | `app.css` (`.notice-*`) | `--color-tint-error` |
| `rgba(255, 107, 107, 0.08)`, `0.45` | `sourceDialog.css` | `--color-tint-error-subtle`, `--color-border-danger-muted` |
| `rgba(62, 224, 181, 0.08)`, `0.16`, `0.28` | `sourceDialog.css`, `source.css` | `--color-tint-ok`, `--color-tint-ok-strong`, `--color-halo-ok` |
| `rgba(90, 169, 255, 0.35)` | `source.css` (reduced motion) | `--color-halo-info` |
| `rgba(6, 32, 24, 0.35)`, `rgba(18, 10, 36, 0.35)` | `capture.css` (dividers) | `--color-divider-on-teal`, `--color-divider-on-violet` |
| `rgba(0,0,0,0.5)`, `rgba(0,0,0,0.6)` | Popover and dialog shadows | `--elevation-popover`, `--elevation-modal` |
| `rgba(5, 8, 14, 0.6)` | `sourceDialog.css` (backdrop) | `--color-scrim-modal` |

Plot canvas (`src/plot/theme.ts`): six values copy token values; four canvas-only values (axis text `#8ea0b8`,
readout text `#e6edf6`, readout backdrop 0.88, the grid and crosshair alphas) become tokens (DESIGN.md Appendix B).

### 7.2 Font sizes

| Size | Where | Target |
| --- | --- | --- |
| 11px | Chips, group labels, waterfall axis, Δ lines, dialog help (F6) | `--font-size-xs` |
| 11.5px | Status bar (F5) | `--font-size-xs` |
| 12px | Hints, sub-lines, readout tables, section titles, inline errors | `--font-size-sm` |
| 13px | Base; labels (F7) | `--font-size-md` |
| 15px | Dialog title, plot hint | `--font-size-lg` |

### 7.3 Opacity, radius, shadow, z-index, motion

- Opacity: 0.45 (buttons, rows, capture), 0.5 (inputs, selects), 0.55 (locked chevron), 0.75 (read-only). F9 and
  DESIGN.md 2.15.
- Radius: `var(--radius)` (6px) on controls; 8px literal on popovers and the dialog; 4px on badges; 2px on swatches;
  50% on the dot. All map to radius tokens.
- Shadows: two values, popover and dialog (above).
- z-index: 20 (popovers), 40 (backdrop). Map to `--z-popover`, `--z-modal`.
- Motion: 150ms fast (opacity, transform); 1000ms pulse and spin; 3000ms highlight.

### 7.4 Geometry

| Geometry | Value | Token |
| --- | --- | --- |
| Toolbar control height | 30px | `--control-height` |
| Field height (toolbar, side panel) | 26 to 28px (computed) | `--control-height` (F1) and `--field-height-compact` |
| Small button | 22.8px (computed) | `--control-height-small` (F2) |
| Icon button | 20px | `--control-height-small` (F2) |
| Source row | 44px; single 30px | `--row-height`, `--row-height-single` |
| Row grid | 18px / 1fr / 64px | `--glyph-cell`, `--badge-column` (test-pinned) |
| Capture main and chevron | 128px and 26px | `--capture-main-width`, `--capture-chevron-width` (test-pinned) |
| Side panel | 330px | `--panel-width` |
| Source popover | 360px (min 280) | `--popover-width` |
| Mode menu | 280px | `--popover-width-mode` |
| Dialog | 440px | `--dialog-width` |
| Centre field | 150px (128px at max-width 1180px) | `--field-width-frequency` |

### 7.5 Duplicates and drift

- Two heading classes with the same style (`.source-heading`, `.mode-heading`) (E5).
- Two popover classes with the same surface (`.source-popover`, `.mode-popover`) (E5).
- Two error text classes at two sizes (`.error` at 13px, `.err`/`.dlg-error` at 12px) (F8).
- The status glyph is defined in React and in CSS (`StatusGlyph` and `.src-dot`), and an inline span copies it (E5).
- Three "locked" styles (0.45, 0.55, 0.75). F9 keeps 0.75 and unifies the others.
- The side-panel select (26px) and number input (28.2px) differ in height (F1).

---

## 8. Prototype and screenshots

- `prototype/index.html`: one file, no network, no build step. Built from the real `src/styles/*.css` (the
  `html, body, #root` and `.app` rules removed) with a scenario switcher (Empty, Typical, Long text, Error) and a
  width control. Views: Tokens, Components, Small fixes (F0 to F15, current and proposed, measured), Screens.
- Changes in this revision: F9 card (0.6), new cards F13, F14, F15, the F0 card (measured thresholds; no reorder of
  `Uncalibrated`), the Components notes (0.6 proposed), the intro (F1 to F15).
- Long text: the 60-character name (`Bench analyser, 2.4 GHz survey, rig A, SA430 near the window`), the device id
  `SA430 08FF41E50F8B3A34`, and a long serial port path. All ellipsis or wrap as DESIGN.md 5.9 says.
- Checked in this revision: the Small fixes view was rendered headless and read back. Measured values match the
  numbers above; the new cards show the proposed values. Screenshots of the changed cards were looked at
  (F0, F9, F13 to F15).
- Limits: the prototype does not render the canvas; fonts are fallbacks.

---

## 9. Verification in this revision

- **Measured in the browser** (headless Chrome, real CSS, `measure/build_harness.py`): toolbar at 1440, 1180, 1024,
  960, 819, 780, 683, 512 CSS px; status bar at 1024 to 1366 px in steps and at the thresholds (1257, 1258, 1078);
  side-panel rows; the target sizes in DESIGN.md 9.9; the plot tag (163px at 1024px).
- **Computed** (`measure/contrast_pairs.py`, WCAG relative luminance from the token values): every pair in
  DESIGN.md 9.3 and 9.4, the unavailable-state table in 9.10, and the candidate boundary colours.
- **Read in the code** (not run): the source lifecycle (`sources.ts`, `session.ts`, `sourceEntries.ts`,
  `SourceMenu.tsx`, `SourceDialog.tsx`, `NoticeBanner.tsx`, `CaptureControl.tsx`), the liveness rules
  (`liveness.ts`), the frame path (`framePump.ts`, `frames.ts`), the canvas (`spectrumRenderer.ts`,
  `envelope.ts`, `SpectrumView.tsx`, `WaterfallView.tsx`, `markers.ts`), the backend session (`crates/spectrum-core`
  session and worker, pacer, simulator rate), and `docs/dsp.md`, `docs/adr/0003`.
- **Not done:** WebKitGTK measurements; the GTK high-contrast theme; `:has()` support in WebKitGTK; whether the
  webview responds to zoom shortcuts (Q-5); real-device screenshots. No production code was changed. `npm run check`
  and `npm run e2e` were not run (no code changed).

---

## 10. Decisions requested at the design gate

Human decisions (each has a recommendation in DESIGN.md 12.2):

1. **Approve or edit F0 to F15.** F1, F2 and F4 (alignment and targets) and F13 to F15 (targets and boundary) are the
   ones the designer would not drop. F9 (0.6) and F15 (boundary colour) are the visual changes to look at.
2. **F0** (Q-1, Q-4): accept the order and track it as a bug.
3. **B1 to B8** (section 3): which go into work 009. Recommended in 009: B1, B2, B7. Recommended separately: B3,
   B4, B5, B6, B8. Q-17 (live-region assignments) and Q-18 (type-ahead) first.
4. **Copy** (Q-2): "press Continuous" / "press Single".
5. **Opacity** (Q-3): 0.6.
6. **Scope** (Q-16): the token read in the canvas (E3) is in 009 or not.
7. **Open product questions**: Q-5 (zoom), Q-6 (toolbar status word), Q-7 (peak click), Q-8 and Q-9 and Q-10 (plot
   features), Q-11 (stale threshold), Q-12 (connect cancel), Q-13 (devices without a serial), Q-14 (touch), Q-15
   (authority), Q-19 to Q-21, Q-22 (switching source while acquiring).
