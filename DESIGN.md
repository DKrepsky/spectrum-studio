# Spectrum Studio design system

| | |
| --- | --- |
| Version | 1.0-draft.5 |
| Last updated | 2026-11-19 |
| Status | Implemented in 009; final QA pending (T13: visual QA, before and after screenshots, WebKitGTK re-measure, zoom check). The PM decided the open items (`decisions.md`; outcomes in sections 12.1 and 12.2). Every decision carries its own status (section 0.3). |
| Scope | The visual and interaction rules for the screens that exist today: toolbar, notice stack, plot and waterfall chrome, side panel, source popover, capture mode menu, Add / Edit source dialog, status bar; the tokens they use; and the `src/ui/` component set that implements them. |
| Out of scope | New screens, new features (listed as Deferred in section 12), plot canvas rendering internals, touch input, light theme. |
| Work item | `009-design-system`: story, `design.md` (inventory, fix list F0 to F17, behaviour changes B1 to B8), `decisions.md` (PM outcomes), `prototype/index.html` (illustrative). |
| Depends on | ADR 0003 (latest-wins frames pulled by the UI), ADR 0013 (capture modes), ADR 0014 (auto-connect and device watch), ADR 0010 (stable device identity), ADR 0015 (`src/ui/` boundary and tokens), `docs/dsp.md` (markers, peaks, display resampling), `CLAUDE.md` (units and backend honesty), WCAG 2.2 AA, `src-tauri/tauri.conf.json` (default 1440 x 900, minimum 1024 x 640), `src/styles/*.css`, `src/plot/theme.ts`, `src/state/liveness.ts`. |
| Replaces | Drafts 1 and 2 (same date). Section numbers changed; the map is in section 13. |
| Review input | Human review r1, verbatim in `.claude/team/work/009-design-system/review-r1.md`. |

Words such as "today" in this file describe the app before work 009 unless the text says otherwise. Section 14 gives the state after 009.

Measurements in this document were taken in headless Chrome on the real CSS in `src/styles/`, with the
fallback fonts available on the test machine (Ubuntu and DejaVu Sans Mono; Inter and JetBrains Mono are
not installed). WebKitGTK widths will differ. QA re-measures the items marked **(re-measure)** in the
webview before the values are relied on.

---

## 0. Document control

### 0.1 Authority

When two sources disagree, the higher one wins. The lower one is corrected in the same change.

1. **This file**, approved sections. Rules, tokens, component contracts, interaction and accessibility requirements.
2. **Component inventory and migration notes**: `design.md` in the work item and the component docs in `src/ui/`. They explain how to reach section 1 from today's code. They never relax a rule here.
3. **Prototypes and previews** (`prototype/index.html`, screenshots). Illustrative only. A prototype that differs from this file is wrong until this file is changed. A prototype never approves a decision.
4. **Token implementation** (the token file). Appendix A is normative. The implemented file must match it; a test enforces this (section 2.18).
5. **ADRs** (`docs/adr/`). They record architecture and technical decisions. An accepted ADR governs technical behaviour (frame transport, backend state, persistence); this file is corrected to match it. This file governs presentation and interaction. A change to a capture or status semantic (sections 2.5 and 2.6) needs an ADR and the designer's approval (section 10).

Note: the order above is the one requested in review r1. Q-15 is decided (PM, work 009): on a technical behaviour both cover, the accepted ADR wins and
this file is corrected to match it; on presentation this file wins.

### 0.2 Requirement levels

- **Must** / **must not**: a requirement. A violation is a review finding.
- **Should**: a recommendation. A deviation needs a reason written in the change.
- **May**: optional.
- **Note:** explanatory or implementation suggestion. Not normative.

### 0.3 Decision status

Each decision in the text and in the register (section 12.1) has one status.

| Status | Meaning |
| --- | --- |
| **Approved** | Binding now for work 009 and later. |
| **Implemented** | Already true in the code at the revision date (file reference given). Binding as current behaviour. Changing it needs a decision. |
| **Proposed** | The designer's recommendation. Not binding until the human approves. The text says what would change. |
| **Deferred** | Known and wanted or possible, but not in the current work. No implementation without a new work item. |
| **Rejected** | Considered and declined. The reason is given. |
| **Open** | A product decision is needed. Listed in section 12.2 with the designer's recommendation. Nothing marked Open may be implemented. |

---

## 1. Purpose and principles

Spectrum Studio is a measurement instrument. Its users are RF engineers and hobbyists who keep it open for
hours, read numbers at a glance and drive it from the keyboard. The interface is dark, dense and precise.
It is not a dashboard and it does not decorate. **Status: Approved.**

1. **Instrument, not dashboard.** Information first. Chrome is quiet: surfaces differ by one step, borders separate, shadows only lift popovers and dialogs.
2. **Measurement integrity over polish.** The UI never smooths, interpolates into a trace, auto-scales the amplitude axis or animates data. Every number shown is a number the backend produced, formatted by the formatters in `src/format/`.
3. **Honest about backend state.** The UI shows what the backend reported (`SessionStatus`), never what it hopes happened. A command in flight is shown as busy; a failure is shown with its reason. Nothing shows a device, a connection or a calibration that is not real.
4. **Units are always labelled.** Every amplitude carries its unit: `dBFS` for IQ-derived spectra, `dB` for a relative level of unknown reference, `dBm` only when a calibration is applied (CLAUDE.md). Uncalibrated data is labelled `Uncalibrated`. No screen implies a calibration that does not exist.
5. **Dense but legible for long sessions.** Base text is 13px. Nothing is below 11px. Numbers are monospaced and never shift width when they update.
6. **Keyboard first, pointer friendly.** Every action has a keyboard path, a visible focus ring and an accessible name. Hover reveals are never the only way to reach an action.
7. **Colour carries meaning, never alone.** Each colour signal has a shape, a word or an icon with it.
8. **Stable geometry.** No state change moves the toolbar, a row's name or a dialog's buttons. Fixed widths and reserved heights are a feature.

---

## 2. Design tokens

### 2.1 Layers and naming (Approved)

Tokens are CSS custom properties defined once, in the token file (Appendix A). There are four layers.
Components read only the semantic layer.

| Layer | Prefix | Example | Who reads it |
| --- | --- | --- | --- |
| Primitive | `--palette-*` | `--palette-teal-400` | The token file only |
| Semantic | `--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--elevation-*`, `--motion-*`, `--z-*`, `--focus-ring-*`, `--opacity-*` | `--color-accent` | Components and feature CSS, the canvas theme (2.18) |
| Geometry | `--control-height`, `--row-height-*`, `--panel-width`, `--capture-*`, `--field-width-*`, ... | `--control-height: 30px` | Components and feature CSS |
| Alias (migration only) | today's names: `--bg`, `--surface`, `--accent`, ... | `--surface` = `--color-surface-panel` | Existing CSS, until migrated. Removed in the release after the migration. |

Rules:

- Component and feature CSS never contain a literal colour (`#`, `rgb(`, `rgba(`), a radius, a shadow or a z-index. They use a semantic or geometry token. The exceptions are in 2.17.
- A new value needs a token first: add it to the token file and to Appendix A, then use it. Never add a value to a component to see how it looks.
- Tokens are named by role, not by the colour they happen to be (`--color-accent`, not `--color-teal`). Two roles that share a value keep two tokens (for example `--color-info` and `--color-focus-ring`), so changing one never changes the other.
- Semantic tokens carry intent. A primitive is never used directly by a component.

Note: today's names (`--bg`, `--surface`, `--surface-2`, `--surface-3`, `--text`, `--text-muted`, `--accent`, `--warn`, `--danger`, `--info`, `--single`, `--radius`) keep working as aliases during migration (2.19).

### 2.2 Colour primitives (Approved)

Primitives are the raw palette. Only the token file and the semantic layer read them.

| Primitive | Hex | Used for |
| --- | --- | --- |
| `--palette-night-900` | `#0b1018` | Window background, input well |
| `--palette-night-850` | `#0e1520` | Plot background |
| `--palette-night-800` | `#121a26` | Panel surface: toolbar, side panel, status bar |
| `--palette-night-750` | `#182233` | Raised surface: popover, dialog |
| `--palette-night-700` | `#1f2b3f` | Control fill, row hover |
| `--palette-night-650` | `#25344c` | Control hover fill |
| `--palette-night-600` | `#26344a` | Dividers, panel edges |
| `--palette-night-550` | `#3a4d6b` | Control hover border |
| `--palette-slate-600` | `#5b6f8f` | Input and select boundary (3:1, F15) |
| `--palette-slate-500` | `#7a8799` | Held and stale trace |
| `--palette-slate-400` | `#8a9ab1` | Secondary text |
| `--palette-slate-350` | `#8ea0b8` | Axis tick text on the plot (canvas only) |
| `--palette-slate-100` | `#dbe4f0` | Primary text |
| `--palette-slate-050` | `#e6edf6` | Crosshair readout text (canvas only) |
| `--palette-teal-400` | `#3ee0b5` | Accent: connected, continuous mode, live, primary action |
| `--palette-teal-500` | `#2bc79e` | Accent hover |
| `--palette-ink-teal` | `#062018` | Text on teal fills |
| `--palette-amber-400` | `#ffb547` | Warning |
| `--palette-red-400` | `#ff6b6b` | Error, failed, stop fill |
| `--palette-red-500` | `#f04848` | Stop fill hover |
| `--palette-blue-400` | `#5aa9ff` | Info, connecting, focus ring, min-hold trace |
| `--palette-violet-400` | `#a47cff` | Single mode fill and icon |
| `--palette-violet-500` | `#9166f5` | Single mode hover |
| `--palette-ink-dark` | `#120a24` | Text on violet and red fills |
| `--palette-orange-400` | `#ff9f43` | Max-hold trace |
| `--palette-magenta-400` | `#ff6bcb` | Marker |
| `--palette-yellow-300` | `#ffd166` | Peak |
| `--palette-white` | `#ffffff` | Active marker and selected peak |

`--palette-warn-strong` (`#f0a22e`) is removed: nothing uses it (F12). The old scrim value that mixed two
opacities into one (`rgba(0, 0, 0, 0.5 / 0.6)`) is removed (T3, 2.4).

### 2.3 Semantic colour roles (Approved)

Every name resolves to a primitive or to a derived value in 2.4.

| Token | Resolves to | Use | Do not use for |
| --- | --- | --- | --- |
| `--color-surface-app` | night-900 | Window background, plot background behind axes | Panels |
| `--color-surface-panel` | night-800 | Toolbar, side panel, status bar | Popovers |
| `--color-surface-raised` | night-750 | Popover, dialog, toast | The plot |
| `--color-surface-control` | night-700 | Button, badge, row hover | Text fields (use `--color-surface-app`) |
| `--color-surface-control-hover` | night-650 | Button hover | Row hover |
| `--color-surface-plot` | night-850 | Canvas plot area | Anything in the DOM |
| `--color-border-default` | night-600 | Dividers, panel and popover edges | Any identification of a control (use `--color-border-input`) |
| `--color-border-hover` | night-550 | Hover border of a control | Selected state |
| `--color-border-input` | slate-600 | Boundary of text fields, number fields and selects (3:1, F15) | Dividers |
| `--color-text-primary` | slate-100 | Labels in content, values, item names, button labels | Hints |
| `--color-text-secondary` | slate-400 | Labels beside controls, hints, notes, sub-lines, group labels, badges | Errors; a label on a hovered control (use primary there) |
| `--color-text-on-accent` | ink-teal | Text on the teal fill | Anything on a dark surface |
| `--color-text-on-violet` | ink-dark | Text on the violet fill | |
| `--color-text-on-danger` | ink-dark | Text on the red fill | |
| `--color-accent` | teal-400 | Connected, acquiring, live, primary action, checked radio | Warnings |
| `--color-accent-hover` | teal-500 | Hover of accent fills | Text |
| `--color-warn` | amber-400 | Warnings: waiting, stale, uncalibrated, warning notes | Pause or running (2.5) |
| `--color-danger` | red-400 | Errors, failed status, required mark, stop fill | Warnings |
| `--color-danger-hover` | red-500 | Hover of the stop fill | Text |
| `--color-info` | blue-400 | Connecting, pending, transient "running" text | Errors |
| `--color-focus-ring` | blue-400 | The one focus ring colour (2.7) | Anything else |
| `--color-capture-continuous` | = `--color-accent` | Continuous mode fill | Stop |
| `--color-capture-continuous-hover` | = `--color-accent-hover` | | |
| `--color-capture-single` | violet-400 | Single mode fill and icon | |
| `--color-capture-single-hover` | violet-500 | | |
| `--color-capture-stop` | = `--color-danger` | Fill while acquiring (Pause or Cancel) | Mode |
| `--color-capture-stop-hover` | = `--color-danger-hover` | | |

### 2.4 Derived colours (Approved)

Alpha colours are written in the token file as `rgba()` with the primitive's RGB and the stated alpha.
The percentage in a description is only a label; the value in the file is the truth.

- The name says what the colour is for, not its percentage (`--color-tint-warn`, not `--color-amber-12`).
- Do not use `color-mix()`, relative colour syntax or `hsl()` for these tokens. Their support in WebKitGTK is not verified in this project.
- Each alpha colour is listed here with its value.

| Token | Value | Derived from | Use |
| --- | --- | --- | --- |
| `--color-tint-ok` | `rgba(62, 224, 181, 0.08)` | teal-400 at 8% | Success test-result box |
| `--color-tint-ok-strong` | `rgba(62, 224, 181, 0.16)` | teal-400 at 16% | Newly saved row highlight (fades) |
| `--color-tint-warn` | `rgba(255, 181, 71, 0.12)` | amber-400 at 12% | Warning banner (F10) |
| `--color-tint-error` | `rgba(255, 107, 107, 0.12)` | red-400 at 12% | Error and command banner |
| `--color-tint-error-subtle` | `rgba(255, 107, 107, 0.08)` | red-400 at 8% | Failed test-result box |
| `--color-halo-ok` | `rgba(62, 224, 181, 0.28)` | teal-400 at 28% | Halo around the connected or acquiring dot |
| `--color-halo-info` | `rgba(90, 169, 255, 0.35)` | blue-400 at 35% | Halo around the connecting dot under reduced motion |
| `--halo-ok` | `0 0 0 2px var(--color-halo-ok)` | Shadow ring | The 2px halo of the connected and acquiring dot (a shadow, so it follows the dot's radius) |
| `--halo-info` | `0 0 0 2px var(--color-halo-info)` | Shadow ring | The 2px halo of the connecting dot under reduced motion |
| `--color-border-danger-muted` | `rgba(255, 107, 107, 0.45)` | red-400 at 45% | Destructive button border |
| `--color-divider-on-teal` | `rgba(6, 32, 24, 0.35)` | ink-teal at 35% | Chevron separator on the teal fill |
| `--color-divider-on-violet` | `rgba(18, 10, 36, 0.35)` | ink-dark at 35% | Chevron separator on the violet and red fills |
| `--color-scrim-modal` | `rgba(5, 8, 14, 0.6)` | Modal backdrop | Dialog backdrop only |
| `--color-scrim-chip` | `rgba(8, 12, 18, 0.8)` | Chip backdrop | Plot tags and zoom reset, over the canvas |
| `--color-scrim-readout` | `rgba(8, 12, 18, 0.88)` | Readout backdrop | Crosshair readout on the canvas (kept separate: different intent, different value) |

Shadows are not scrims. They are elevation tokens (2.11).

### 2.5 Capture colour semantics (Approved; settled in work 006)

This is the most important semantic in the app. Preserve it.

| Backend state (`SessionStatus`) | Mode | Fill (main and chevron) | Icon | Main label (visible) | Accessible name of main segment | Plot tag |
| --- | --- | --- | --- | --- | --- | --- |
| connected, idle | continuous | `--color-capture-continuous` (teal) | Play | Continuous | Start continuous acquisition | none, or `HOLD` if a trace is held |
| connected, idle | single | `--color-capture-single` (violet) | Play | Single | Start single capture | none, or `HOLD` |
| acquiring | continuous | `--color-capture-stop` (red) | Pause | Continuous | Pause continuous acquisition | `LIVE`, `Waiting for data…` or `No data for N s` |
| acquiring | single | `--color-capture-stop` (red) | Stop | Single | Cancel single capture | `CAPTURING` (violet) |
| connecting, disconnecting, disconnected | any | Unavailable (`--opacity-unavailable`) | Play | mode | Start continuous / single acquisition | the reason (6.8) |

Rules:

- Colour says the **mode** (teal Continuous, violet Single). Red says **the control stops something** (Pause or Cancel). Amber is **never** used for running or pause; it means a warning.
- Running is shown by the icon, the accessible name and the plot tag. Never by colour alone.
- Ink on every fill keeps AA (table 9.3). Hover darkens the fill; the ink does not change.
- The chevron is **unavailable** (aria-disabled, focusable, reason in the description) while acquiring or while a command runs (9.10).
- Mode colours are not reused for anything else.

### 2.6 Status and feedback (Approved; wording clarified)

Each status has a shape, and a word. The word is either visible or part of the accessible name. The
table says where. "Always shown" in draft 1 was wrong for some states: this table is the rule.

| Status | Glyph (shape) | Visible word | Where the visible word is | Accessible name carries the word |
| --- | --- | --- | --- | --- |
| Connected | Solid teal dot with a 2px halo | Connected | Popover row, line 2 | Yes (button name) |
| Acquiring | Solid teal dot with a 2px halo | Acquiring | Popover row, line 2 | Yes |
| Connecting | Solid blue dot, pulsing (static under reduced motion) | Connecting… | Popover row, line 2; plot tag and capture tooltip | Yes |
| Disconnecting | Solid blue dot, pulsing | Disconnecting… | Popover row, line 2 | Yes |
| Failed | Bold red cross (`✕`) | Failed | Popover row, line 2; the reason is in the banner | Yes |
| Not detected | Empty ring (2px border) | Not detected | Popover row, line 2 | Yes |
| New (detected, not remembered) | Solid grey dot | New | Popover row, line 2 | Yes |
| Idle (remembered, not connected) | Solid grey dot | **none, by design** | Not shown | No status word in the name |
| Source button (side panel, any state) | The glyph of the table above | **none** (the glyph is the visible signal; the word is in the name and the tooltip) | Not shown | Yes |

Rules:

- **Idle has no visible word, by design.** A remembered source that is not connected is the default; a word would add noise to every row. Its name says nothing about status.
- **The source button shows the glyph only.** At 1024px the name of the source is the scarce space (3.6). Connected and acquiring look the same on the source button (both teal); acquisition is visible on the capture control (red Pause or Stop), which is the last item of the same panel group. Open question Q-6 asks whether the source button should show a word.
- The glyph is 10px in an 18px cell (`--glyph-cell`, `--glyph-dot`). Its word on line 2 of a row says the same thing.
- A status glyph is `aria-hidden`; the word or the name carries the state.

| Other signal | Glyph | Words | Colour token |
| --- | --- | --- | --- |
| Warning | `⚠` in text | The message | `--color-warn` |
| Uncalibrated | none | `Uncalibrated` | `--color-warn` |
| Required mark | `*` | Field name | `--color-danger` |

### 2.7 Surfaces, borders, text and focus (Approved)

- Surface steps are one step apart. Do not invent a fifth step. Hover on a control is `--color-surface-control-hover` with `--color-border-hover`; hover on a list row is `--color-surface-control`.
- On a hovered control the label is `--color-text-primary` (9.78:1 on the hover fill). Secondary text on the hover fill is 4.38:1 and is not allowed.
- Dividers and panel edges use `--color-border-default` (decorative; not required for identification).
- Text fields, number fields and selects use `--color-border-input` (F15). Buttons keep `--color-border-default` because their label identifies them (9.4).

**Focus ring (single definition).** The tokens are defined in Appendix A.

```css
outline: var(--focus-ring-width) solid var(--color-focus-ring);   /* 2px, blue-400 */
outline-offset: var(--focus-ring-offset);                          /* 1px, drawn outside the control */
```

| Token | Value | Use |
| --- | --- | --- |
| `--color-focus-ring` | `#5aa9ff` (blue-400) | The only focus colour. Its own token, not `--color-info`. |
| `--focus-ring-width` | `2px` | Every focus ring |
| `--focus-ring-offset` | `1px` | Every single control and every row: ring outside the box |
| `--focus-ring-offset-group` | `2px` | One ring around a composite control (capture split control) |

- Use `outline`, never `box-shadow`, for focus. Never `outline: none` without a replacement ring.
- Inside rings are not used. A ring drawn inside is invisible on a filled control (F4 corrects the mode items).
- The ring is at least 3:1 against its surroundings. Blue-400 is 7.12:1 on the panel, 6.50:1 on raised surfaces and 7.46:1 on the plot (table 9.4).
- A composite control draws one ring around the group (`:has()` on the group; **re-measure in WebKitGTK**, see A8). A ring on a neighbouring teal or violet fill is about 1.3:1 and disappears.
- The attention outline of the source button (no source chosen) is a 2px teal outline. It is not a focus indicator. When the button has focus, the focus ring replaces it.
- Forced-colours mode is not verified (9.14). The focus ring is an outline, so it survives forced colours; the status glyphs use borders and text, so their shapes survive too.

### 2.8 Typography (Approved)

Families:

- `--font-family-ui`: Inter, Cantarell, Ubuntu, system-ui, sans-serif (current stack; fonts are not bundled).
- `--font-family-mono`: JetBrains Mono, DejaVu Sans Mono, ui-monospace, monospace (current stack).

Scale:

| Token | Size | Line height | Role |
| --- | --- | --- | --- |
| `--font-size-xs` | 11px | 1.4 | Chips, badges, plot tags, transport badge, status bar (F5), group labels (caps), axis ticks, Δ lines |
| `--font-size-sm` | 12px | 1.4 | Hints, notes, help text, sub-lines of rows, readout table cells, section titles (caps), inline errors |
| `--font-size-md` | 13px | 1.4 | Base: controls, labels, body, item names, banner text, dialog labels |
| `--font-size-lg` | 15px | 1.3 | Dialog title, plot placeholder hint |

Weights: `--font-weight-regular` 400; `--font-weight-medium` 500 (readout table headers); `--font-weight-semibold` 600 (section titles, plot tags, capture label, primary button, group labels); `--font-weight-bold` 700 (brand, marker and peak ids, failed glyph, dialog title).

Tracking: `--letter-spacing-caps` 0.06em (uppercase group labels and section titles); `--letter-spacing-chip` 0.05em (plot tags); `--letter-spacing-brand` 0.02em (brand). Transport badges use 0.03em today; the 0.02em difference is not visible and is not in the fix list.

Roles:

| Role | Tokens | Example |
| --- | --- | --- |
| Label beside a control | md, regular, secondary | "Center", "FFT size", "Name" |
| Hint or help under a control | sm, regular, secondary | "Click the spectrum to place a marker." |
| Group label in a menu | xs, caps, regular, secondary | "YOUR SOURCES" |
| Section title in the side panel | sm, caps, semibold, secondary | "MEASUREMENT" |
| Item name in the popover | md, regular, primary | "Bench SA430" |
| Sub-line in a popover row | sm, regular, secondary; the detail in mono xs | "Acquiring · /dev/ttyACM0" |
| Readout (values that update) | mono; sm in tables, md in fields, xs in the status bar | "100.250000 MHz", "-20.00 dBFS" |
| Dialog title | lg, bold | "Edit source" |
| Plot tag | xs, semibold, caps tracking | "LIVE", "HOLD · last data 13:44:46" |

Numerals:

- Readouts that change at frame rate are always mono, so digits do not shift width. Mono is `--font-family-mono`.
- Numbers in sans text (a count in a label) use `font-variant-numeric: tabular-nums`.
- Frequencies keep the decimal places that the resolution sets (7.5). Digits do not appear or disappear as a value moves within a span.

Line-height tokens: `--line-height-body` 1.4; `--line-height-title` 1.3.

### 2.9 Spacing (Approved)

Base unit 2px. Use the scale. A value outside it needs a reason (2.17).

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-1` | 2px | Gap between a glyph and its text; table cell gap |
| `--space-2` | 4px | Gap in a chip; label to control in a stacked field; heading to list |
| `--space-3` | 6px | Gap in a button row; group padding; gap in a row sub-line |
| `--space-4` | 8px | Default gap in a row or toolbar group; item padding; panel body gap |
| `--space-5` | 12px | Horizontal page padding (toolbar, status bar, panels); dialog gap |
| `--space-6` | 16px | Dialog padding (vertical); status bar item gap |
| `--space-7` | 24px | Empty-state padding (reserved) |

Existing off-scale values (10px notice gap, 14px checkbox group gap, 5px row padding, 7px toolbar
padding) are kept where a test pins them (`src/components/source/source.css.test.ts`, `src/ui/SplitButton/SplitButton.geometry.test.ts`). New code uses the scale.

Known off-scale token values, kept in 009 and marked in Appendix A: `--row-gap` (3px), `--capture-main-gap` (7px), `--capture-main-padding-x` (10px), `--field-padding-frequency` (7px), `--plot-tag-padding-x` (9px), `--source-test-min-height` (62px), `--source-test-gap` (10px), `--source-test-padding-y` (5px), `--toolbar-padding-y` (7px), `--waterfall-tick-gap` (3px), `--legend-swatch-width` (10px) and `--legend-swatch-height` (3px). The next visual pass may snap them to the scale. That is a visible change and needs the before and after check of 10.4.

**Every pixel value in a spacing or size property is a token** (work 009 QA fix, BUG-3). The token guard (`src/styles/tokens.test.ts`, "pixel sizes and spacing") checks `padding`, `margin`, `gap`, the inset sides, `width`, `height`, `min-*`, `max-*`, the grid and flex sizes, `font-size` and the outline and border widths in every component and feature stylesheet. Only the hairlines stay literal: `0` and `1px` (and `-1px` for the visually hidden box), as 2.17 allows. A value that is on the scale uses the scale token; an off-scale value gets a named token in `tokens.css` and a row in 2.10 and Appendix A.

### 2.10 Component geometry (Approved)

| Token | Value | Use |
| --- | --- | --- |
| `--control-height` | 30px | Source button and capture control (side panel, 3.6) and the toolbar size of a field or select (4.4, 4.5) |
| `--field-height-compact` | 28px | Fields and selects in the side panel and the dialog (number inputs measure 28.2px; side-panel selects measure 26px today: F1) |
| `--control-height-small` | 24px | Minimum height of a small button, an icon button and a checkbox label (WCAG 2.2 target, 9.9) |
| `--target-min` | 24px | The minimum for every interactive target (9.9) |
| `--glyph-cell` | 18px | Status glyph and menu icon cell |
| `--glyph-dot` | 10px | Status dot |
| `--row-height` | 44px | A two-line popover row: line 1 (glyph, name, badge), line 2 (status, port in the name column). The row actions sit in the badge column, centred on the row, and replace the badge while shown (4.11). Ruling, work 009 T9 (2026-11-16): 44px kept |
| `--row-height-single` | 30px | A one-line popover row (fixed items) |
| `--row-gap` | 3px (off-scale, as before 009) | Space between two popover rows: the pitch is 47px for a 44px row |
| `--panel-width` | 330px | Side panel column (fixed at every supported width) |
| `--popover-width` | 360px | Source popover (min 280px; max `calc(100vw - 16px)`; max-height 70vh). In the side panel it is as wide as the source button (4.11) |
| `--popover-width-mode` | 280px | Capture mode menu |
| `--dialog-width` | 440px | Add / Edit source dialog (max `calc(100% - 24px)`) |
| `--dialog-offset-top` | 90px | Space above the dialog, so it sits under the toolbar |
| `--dialog-padding-inline` | 18px | Left and right padding of the dialog |
| `--badge-column` | 64px | Transport badge column of a source row (pinned by a test) |
| `--capture-main-width` | 128px | Capture control main segment (pinned by a test) |
| `--capture-chevron-width` | 26px | Capture control chevron (pinned by a test) |
| `--capture-main-gap` | 7px | Capture control main segment: icon to label (off-scale, as before 009) |
| `--capture-main-padding-x` | 10px | Capture control main segment: inline padding (off-scale, as before 009) |
| `--field-width-inline` | 140px | Side panel control column: select, number and frequency (Center, Span). One width so the rows align; fits `5.999000000 GHz` (3.6) |
| `--field-width-unit` | 90px | Number with a unit suffix (side panel) |
| `--field-width-param` | 140px | Frequency parameter in a connect form |
| `--field-padding-frequency` | 7px | Frequency field inline padding (off-scale, as before 009) |
| `--plot-chip-inset-top` | 14px | Plot tags and zoom reset, from the top of the plot |
| `--plot-chip-inset-right` | 22px | Plot tag, from the right of the plot |
| `--plot-tag-padding-x` | 9px | Plot tag inline padding (off-scale, as before 009) |
| `--notice-stack-max` | 96px (Deferred, B6) | Maximum height of the notice stack before it scrolls. Not in 009 (backlog). |
| `--source-test-min-height` | 62px (off-scale, as before 009) | Test connection result box in the source dialog: reserved for idle and ok, so the dialog does not jump |
| `--source-test-gap` | 10px (off-scale, as before 009) | Test connection button to its result box |
| `--source-test-padding-y` | 5px (off-scale, as before 009) | Vertical padding of the test connection result box |
| `--toolbar-padding-x` | 12px (8px at max-width 1180px) | Toolbar horizontal padding (3.3). The toolbar holds the brand only |
| `--toolbar-padding-y` | 7px (off-scale, as before 009) | Toolbar vertical padding |
| `--plot-zoom-reset-inset-left` | 76px | Zoom reset control, from the left of the plot |
| `--plot-hint-padding-x` | 40px | Plot hint: horizontal inset, so its text wraps clear of the plot edges |
| `--waterfall-tick-gap` | 3px (off-scale, as before 009) | Waterfall tick label to its mark |
| `--legend-swatch-width` | 10px (off-scale, as before 009) | Hold-trace legend swatch, width |
| `--legend-swatch-height` | 3px (off-scale, as before 009) | Hold-trace legend swatch, height |
| `--button-icon-slot` | 12px | Button icon slot: the icon and the spinner take the same box |
| `--menu-end-column` | 16px | Menu item, trailing column (shortcut or mark) |
| `--status-dot-ring-width` | 2px | Absent status dot: ring width |
| `--source-row-sub-min-height` | 17px | Source row, line 2: keeps its line height when empty |

### 2.11 Radius (Approved)

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | 2px | Colour swatch in a legend (trace swatches) |
| `--radius-sm` | 4px | Chips and tags: badges, plot tags |
| `--radius-md` | 6px | Controls (buttons, inputs, selects), popover rows, group boxes, test-result box (`--radius` today) |
| `--radius-lg` | 8px | Surfaces: popover, dialog |
| `--radius-round` | 50% | Status dot |

A split control has its outer corners at `--radius-md` and an inner join that is square.

### 2.12 Elevation (Approved)

Panels, toolbars and rows have no shadow. Borders separate them.

| Token | Value | Use |
| --- | --- | --- |
| `--elevation-none` | none | Default |
| `--elevation-popover` | `0 12px 36px rgba(0, 0, 0, 0.5)` | Source popover, capture mode menu |
| `--elevation-modal` | `0 16px 48px rgba(0, 0, 0, 0.6)` | Add / Edit source dialog |

### 2.13 Motion (Approved)

| Token | Value | Use |
| --- | --- | --- |
| `--motion-duration-instant` | 0ms | State changes with no animation |
| `--motion-duration-fast` | 150ms | Row action reveal (opacity and a 6px slide); transport badge fade under the actions |
| `--motion-duration-pulse` | 1000ms | Connecting and disconnecting dot |
| `--motion-duration-spin` | 1000ms | Spinner |
| `--motion-duration-highlight` | 3000ms | Newly saved row: tint, then fade |
| `--motion-pulse-opacity-min` | 0.25 | Low point of the pulse |
| `--motion-ease-standard` | ease-out | Reveal and fade |
| `--motion-ease-loop` | ease-in-out | Pulse |
| `--motion-ease-linear` | linear | Spinner |

Reduced motion (`prefers-reduced-motion: reduce`) is required for every animation:

- Spinner: a static ellipsis `…` next to the text.
- Connecting or disconnecting dot: no pulse; the 2px halo in `--color-halo-info` stays, so the state is still visible. The text carries the state in every case.
- Row action reveal: no slide; the opacity change stays.
- Newly saved row: no animation; a static 2px accent outline for the same time.

Limits: no animation longer than 3s; nothing loops except the spinner and the pulse; **no motion on data**: traces and readouts never animate between frames.

Note: the pulse drops to 25% opacity at its low point, below 3:1 for that moment. The state is also in the text ("Connecting…"), so this is accepted (9.13).

### 2.14 Z-index (Approved)

| Token | Value | Use |
| --- | --- | --- |
| `--z-base` | 0 | Normal flow |
| `--z-overlay` | 10 | Plot tags and readouts over the canvas |
| `--z-popover` | 20 | Source popover, capture mode menu |
| `--z-modal` | 40 | Dialog backdrop and dialog |
| `--z-tooltip` | 60 | Reserved for a custom tooltip (Deferred, 5.4; native `title` is used today) |

Nothing else sets a z-index. A new layer is added here first.

### 2.15 Opacity states (Approved; values implemented in 009, F9)

Three states use opacity. No other opacity is used for a control state.

| State | Token | Value | Focusable | Still readable | Reason given where |
| --- | --- | --- | --- | --- | --- |
| **Unavailable** (disabled, or locked while acquiring or while a command runs, as the chevron and the popover rows are) | `--opacity-unavailable` | 0.6 (today: 0.45 buttons and rows, 0.5 inputs and selects, 0.55 locked chevron) | Native `disabled`: no. `aria-disabled`: yes | Label visible; reason in the description and visible somewhere on the screen (5.4) | Plot hint, badge, status bar, or the control's description |
| **Read-only, in use** (fields of the connected source in the dialog) | `--opacity-read-only` | 0.75 | No | Yes (value visible; 6.93:1 on the control fill) | Dialog note: "This source is connected…" |

A **busy** control is not unavailable (rule U1, 12.1): a busy button or the busy capture main keeps full strength, with its spinner or progress cursor. The capture chevron is dimmed while a command runs (2.5). Contrast of the unavailable state is in 9.10. Opacity 0.6 is the value accepted by the PM (F9, Q-3); it is the
lowest value, in steps of 0.05, at which the primary label reaches 4.5:1 on the control fill (0.55 gives 4.45:1).

### 2.16 Canvas-only values (Approved)

The canvas (plot and waterfall) is drawn with the same tokens as the DOM (2.18). Canvas-only values
are tokens too, so they are visible in one place:

- `--color-text-axis` (slate-350) for tick labels; the DOM secondary text is slate-400. Both are AA. Merging them is Proposed (T8).
- `--color-text-readout` (slate-050) for the crosshair readout.
- `--color-scrim-readout` for the readout backdrop.

### 2.17 Allowed literals (Approved)

The only literals allowed in component and feature CSS:

- `0`, `100%`, `50%` (round dot), `1px` borders and dividers. The hairlines are the only pixel literals: `0`, `1px` and `-1px` (the visually hidden box), checked by the size guard (`tokens.test.ts`, "pixel sizes and spacing"). Every other pixel value in a spacing or size property is a token, or `calc()` of tokens (BUG-3, 009 QA).
- Layout values that are a function of other tokens (for example `calc(100% + var(--space-2))` for the popover offset).
- Geometry that a test pins. These are named tokens too (`--glyph-cell`, `--capture-main-width`, `--capture-chevron-width`, `--badge-column`), and the contract tests read the tokens.

Anything else is a finding in review.

### 2.18 Token source of truth, consumers and tests (Approved)

**One file.** The token file is `src/styles/tokens.css` (the name is the designer's proposal; the staff engineer may choose another name in the ADR, but there is still one file). It contains exactly the content of Appendix A. No other file defines a token.

**Consumers:**

| Consumer | How it reads tokens | Rule |
| --- | --- | --- |
| CSS (`src/styles/*.css`, component CSS) | `var(--token)` | No literals (2.17) |
| React components (`src/ui/`, `src/components/`) | Class names only. Inline styles only for values computed from plot geometry (for example `PLOT_INSETS` in `WaterfallView`) | No colour or size literal in TSX |
| Canvas (`src/plot/theme.ts`) | At module start, `getComputedStyle(document.documentElement).getPropertyValue('--token')` for each key in Appendix B. The canvas never holds a copy of a colour. | A missing token is an error, not a fallback. Data palettes (`src/plot/colormap.ts` stops) are the one exception: they are data encodings, used only by the waterfall, and stay in TypeScript (9.5). |
| Tests (Vitest, jsdom) | The test reads `src/styles/tokens.css` as text and parses it. jsdom does not load stylesheets, so computed styles are not used. | |
| Visual check (governance, 10.4) | Before and after screenshots | Manual until a visual regression tool is approved (Deferred) |

**Tests that enforce this (Approved; to be written in the implementation work):**

1. Token parser: every `var(--x)` used in `src/**/*.css` and `src/**/*.ts(x)` is defined in `tokens.css`.
2. Literal guard: component and feature CSS contain no `#`, `rgb(`, `rgba(`, `hsl(`, shadow, radius or z-index literals outside the 2.17 list.
3. Contrast: the pairs in section 9.3 and 9.4 are computed from the token values and must meet their ratios.
4. Canvas map: every key of `PLOT_THEME` maps to a token that exists (Appendix B).
5. Appendix A equals `tokens.css` (the file is generated from Appendix A, or the test compares them).

**Choosing a token for a new component or state (Approved):**

1. What does it mean? (Data, status, action, surface, text, focus, geometry.) Pick the semantic role from 2.3 or 2.10.
2. Is there one? Use it. Do not add a second name for the same role.
3. Is there none? Add a semantic token with a role name, a value in the token file and a row in Appendix A and in the register. Check its contrast (9.3, 9.4).
4. Is the state new? Pick one of the three states in 2.15. A new number is not a state.

### 2.19 Naming and migration (Approved)

| Current (`src/styles/app.css`) | Target | Note |
| --- | --- | --- |
| `--bg` | `--color-surface-app` | |
| `--surface` | `--color-surface-panel` | |
| `--surface-2` | `--color-surface-raised` | |
| `--surface-3` | `--color-surface-control` | |
| `--border` | `--color-border-default` | |
| `--text` | `--color-text-primary` | |
| `--text-muted` | `--color-text-secondary` | |
| `--accent` | `--color-accent` | |
| `--accent-strong` | `--color-accent-hover` | |
| `--warn` | `--color-warn` | |
| `--warn-strong` | removed | F12 |
| `--danger` | `--color-danger` | |
| `--danger-strong` | `--color-danger-hover` | Stop hover |
| `--danger-ink` | `--color-text-on-danger` | Same value as `--single-ink` |
| `--info` | `--color-info` | Its focus use moves to `--color-focus-ring` (same value) |
| `--single` | `--color-capture-single` | |
| `--single-strong` | `--color-capture-single-hover` | |
| `--single-ink` | `--color-text-on-violet` | |
| `--radius` | `--radius-md` | |
| `--control-height` | `--control-height` | Unchanged name |
| `--font` | `--font-family-ui` | |
| `--mono` | `--font-family-mono` | |

Aliases remain for one release, then are removed (10.1, rule 7). Status after 009: no CSS, TS or TSX file uses an alias (`tokens.test.ts` guards the CSS; a search of `src/` and `e2e/` finds none in TS or TSX). Removal is the next release's work.

---

## 3. Layout and responsive behaviour

### 3.1 Window (Approved)

| Property | Value | Source |
| --- | --- | --- |
| Default | 1440 x 900 | `src-tauri/tauri.conf.json` |
| Minimum | 1024 x 640 | `src-tauri/tauri.conf.json` |
| Fixed regions | Toolbar and status bar (height from content, no token: 33px and 24px measured in 013 at 1024 x 640; the status bar is 4px padding above and below, a 1px top border and one 11px line); side panel 330px | |
| Flexible | Plot column; the source name (shrinks first, to its minimum); the notice stack (grows with content, capped by B6) | |
| Scrolling | The side panel scrolls vertically. The window never scrolls. The popover list scrolls inside its own section. | |

### 3.2 Width ranges (Approved)

The three ranges follow the CSS. The narrow rules apply at `max-width: 1180px`, which includes 1180.
The review's wording (1180 to 1439 and 1024 to 1179) is kept; the one-pixel boundary follows the CSS.

| Range (window width, CSS px) | Toolbar | Status bar (fallback fonts) | Side panel | Plot column |
| --- | --- | --- | --- | --- |
| **A: 1440 and above** (default 1440 x 900) | Padding 12px. Brand only (the source button and the capture control are in the side panel since 040). | All 10 items, `Uncalibrated` visible. Shown from 1258px. | 330px | Width minus 330px (1110px at 1440) |
| **B: 1181 to 1439** | Brand only | 10 items from 1258px. 9 items (no `Frame`) from 1181 to 1257px. `Uncalibrated` hidden today; visible with F0. | 330px | 851 to 1109px |
| **C: 1024 to 1180** (minimum 1024 x 640) | Padding 8px. Brand only. | 9 items (no `Frame`) from 1078 to 1180px. 8 items (no `Frame`, no `Rate`) from 1024 to 1077px. `Uncalibrated` hidden today in all of C; visible with F0. | 330px | 694 to 850px |

Measured with the real CSS in WebKitGTK (issue 40, work 013, after the source button and the capture control moved to the side panel):

- The source button is 305px wide at 1440 and at 1024, the width of the side panel's column (3.6). Its name area is 238px; a 60-character name is truncated with an ellipsis (the rest is in the tooltip and the accessible name), and the 22-character device id is shown in full.
- The toolbar holds the brand only: 122px wide and 33px tall at 1440 and at 1024. Nothing in it can overlap or clip. The spare-width and overlap figures of work 012 (for the toolbar's source group and capture control) no longer describe the layout and are removed. Zoom (Q-5) is not re-measured for the side panel; the rows under 3.9 are from before 040.
- The source popover (305px) and the capture mode menu (280px, right-aligned to the capture control) open inside the side panel's column and inside the window at 1440 and 1024 (4.11, 3.6).
- The side panel's rows have 305px of usable width. The longest label ("Reference level") is 91px wide, so label and 140px control fit.

### 3.3 Toolbar (Approved; brand only since 040)

The toolbar is one row with the brand (mark and `Spectrum Studio`) and nothing else. The source button and the capture control were its source group until issue 40. They are now the first and last items of the side panel's Measurement group (3.6), so the device, the tuning and the capture sit in one column, top to bottom. Center and Span have been in that group since 038.

| Element | Width rule | Shrinks? | Visible at every supported width |
| --- | --- | --- | --- |
| Brand (`Spectrum Studio`, mark) | Content width (122px measured in 040) | No | Yes |

Rules:

1. The toolbar has no controls. Its height comes from the brand and the padding (33px measured in 040). It is never a source of overlap.
2. The brand stays on one line (a wrapped brand would make the toolbar taller; the e2e guard checks it).
3. Source names and the capture control are side panel concerns: their rules are in 3.6, 4.3 and 4.11, and the source name is truncated with an ellipsis there.

### 3.4 Status bar (Approved for order and priority; mechanism implemented in 009, F0)

One line, mono 11px (F5). Items are `label value`: the label in sans, the value in mono. Items are separated by 16px.

**Order** (left to right): Center, Span, RBW, FFT, Avg, Noise floor, Unit, Rate, Frame, then `Uncalibrated`, right aligned.

**Priority.** When the items do not fit, whole items are removed in this order (first removed first). Removal is never a cut.

| Removal order | Item | Note |
| --- | --- | --- |
| 1 (first) | Frame (`#seq · hh:mm:ss`) | The plot tag and the stale message already show data age |
| 2 | Rate (fps) | Diagnostics: frames received per second |
| 3 | Noise floor | |
| 4 | FFT (size and window) | |
| 5 | Avg | |
| 6 | RBW | |
| Never removed | Center, Span, Unit, `Uncalibrated` | `Unit` and `Uncalibrated` are pinned at every width |
| No-frame state | One sentence (copy in 8.1); never removed | |

Note: the removal order was proposed by the designer and accepted by the PM (Q-4).

**Measured thresholds** with the fallback fonts (all 10 items need 1258px; the first removal leaves 9 items that fit from 1078px; 8 items fit at 1024px):

- At 1257px the full set cuts `Uncalibrated`. At 1258px it fits (measured).
- Without `Frame`, `Uncalibrated` is visible from 1078px (measured). Without `Frame` and `Rate` it is visible at 1024px (measured).
- **Draft 1 said `Uncalibrated` is visible at 1180px. That was wrong.** At 1180px, `Uncalibrated` is cut today (measured: its right edge is at 1246px against a bar edge of 1168px). The calibration state is hidden at every width from 1024 to 1257px today.

Mechanism (implemented in 009; F0, Q-1 accepted by the PM): `StatusStrip` (`src/ui/StatusStrip/`) measures the strip (a `ResizeObserver`; no IPC, no state) and removes items by their `dropOrder`, lowest first, until the rest fit. Items without a `dropOrder` are pinned. The CSS-only fallback in draft 2 (hide `Frame` below 1280px, `Rate` below 1100px) is not part of the implementation. QA re-measures with the real fonts (re-measure).

Other rules:

- It shows only what the current frame carries. With no frame it shows one sentence about the state (copy in 8.1).
- `Uncalibrated` is shown when a frame is present and its unit is `dbfs` or `db`. It is not shown when the unit is `dbm` (which requires a calibration; none exists today).
- Items with a longer explanation carry it in `title` (for example `RBW`: "Equivalent noise bandwidth of one bin"). Status bar items are not interactive.
- The status bar is a `footer` (contentinfo landmark). It is not a live region (9.6).

### 3.5 Notice stack (Approved; cap deferred to the backlog, B6)

- Sits between the toolbar and the workspace. Zero or more banners, stacked, full width.
- Each banner: one message for one cause (5.7), at most one recovery button, and a dismiss button (`×`, labelled `Dismiss`).
- Long messages wrap. They are never truncated, because the reason is the point of the message.
- **Deferred (B6, Q-20; backlog):** the stack has a maximum height of `--notice-stack-max` (96px, about three one-line banners). Beyond that the stack scrolls inside itself. The workspace height never drops below the plot's minimum (3.7).

### 3.6 Side panel (Approved)

- A stack of collapsible sections (`details` and `summary`). Default open: Measurement, Markers, Peaks, Display. Default closed: Source settings.
- Width is 330px at every supported width (`--panel-width`). The panel never shrinks and never grows, so its minimum and maximum are both 330px. The plot takes the rest.
- Section body padding `0 12px 12px`, gap 8px. Label column to the left of the control; label in secondary text; control right aligned at a fixed width (140px select, number and frequency, the same in every row so they align; 90px with a unit suffix).
- **Measurement (015 order, 014 rows; 2026-11-19; supersedes the 040 order).** Order: the source button (full width, 4.11; its name truncates with an ellipsis, 305px column at 330px panel width), Center, Span, the source's own measurement rows, Averaging, the hold row (Max hold, Min hold, Reset), and the capture control (full width, 4.3). The source button and the capture control were in the toolbar before 040.
- **Rows a source does not use are hidden, not disabled (014, Approved).** Trace source (its data is measured traces): Center, Span, Frequency step (kHz), Reference level (dBm), Averaging, hold row. IQ source (its data is computed here): Center, Span, FFT size, Window, Averaging, hold row. Both kinds have two kind rows, so the block has the same height for either and the capture control does not move when the kind changes. Frequency step and Reference level are device settings and no longer appear in Source settings. The source reports which rows it uses; the UI never checks a device name (`docs/sources.md`).
- **Kind rows with no source connected (014, 015; Proposed).** The kind rows follow the kind of the selected source as last reported (DESIGN.md 5.2.10). They are shown disabled with the reason "Connect a source first" ("Connecting…" or "Disconnecting…" during a transition; "Status unavailable" when start-up failed, S12). Device values show an em dash (`—`), as Center does, because no value is known from the device now. FFT size and Window keep their processing values (the app holds them). If no kind has been reported for the selected source in this run (start-up, or never connected), no kind rows are shown: a source not opened this run has its kind rows hidden (for example a device that failed at launch, or a remembered device after a restart), and only the rows every source has are shown. Showing those rows disabled is follow-up issue #47. Averaging and the hold row stay enabled with no source; they appear once the processing settings are known.
- **Focus when a kind row disappears (014, Proposed).** Focus moves to the next control in Measurement in DOM order (Averaging), else to the source button. No live announcement is added.
- **Measurement rows use the field components of 4.4 with the same commit, validation, error and focus rules as the Source settings they came from (014, Approved).** Center and Span keep their rules: with no source, Center shows an em dash (`—`) and is disabled, as Span is; it never shows `0 Hz`. The widest frequency shown is `5.999000000 GHz` (15 characters, the simulator's range up to 6 GHz); it fits the 140px control with its padding, and the visual guard checks it at 1440, 1180 and 1024.
- A row whose label and control do not fit is a bug. At 330px the widest row has 305px of room (3.2).
- **Popovers and menus from the panel** must fit the column. The panel is a scroll box (`overflow-y: auto`), which clips anything that extends past its left or right edge. The source popover is therefore as wide as the source button (305px, 4.11). The capture menu (280px) is right-aligned to the capture control. Both open below their trigger, and open above it when there is no room below inside the window or the panel (`usePopupFlip`, `.popover-up`; 4.11). Both are visible in the window at 100% and at 200% zoom (e2e: `acquisition.e2e.ts`).
- **The capture control is not sticky (decided by the human in 013).** It scrolls with the side panel: with Source settings open it can be scrolled out of view. Its state stays visible in the plot tag and the status bar, and the mode and the start are reachable again by scrolling up. Pinning it, or moving Source settings, was considered and not chosen.
- The panel scrolls vertically inside itself. Sections never hide controls, except the Measurement rows a source does not use (014), which are removed, not disabled.
- **Growth of the peak table** pushes the sections below it down, which is a layout shift (7.4). **Deferred (B5; backlog):** the peak table body has a maximum height of eight rows and scrolls inside.

### 3.7 Plot column (Approved; hide rule deferred to the backlog, Q-21)

- Spectrum flex 3 and waterfall flex 2 when the waterfall is shown. The spectrum fills the column when it is hidden. Both are fixed by flex weight, not by content.
- At a 640px window height the workspace is 583px: 640 less the 33px toolbar and the 24px status bar (measured in 013 at 1024 x 640; the status bar has no height token, its height comes from its content, so the figure is the measured one). The spectrum is about 345px and the waterfall about 235px at that height. A notice takes space from both.
- **Deferred (Q-21; backlog):** below a total plot height of 240px, the waterfall is hidden automatically while the user's setting (`showWaterfall`) stays on. The spectrum is never less than 200px.
- Chips over the canvas (6.8): the state tag top right (`--plot-chip-inset-top`, `--plot-chip-inset-right`); the zoom reset top left (76px from the left, when zoomed); the hint centred. They do not overlap at 1024px (the tag is 163px wide, measured, on a 694px plot).

### 3.8 Overlays (Approved)

- Popovers (source popover, capture mode menu) are anchored under their trigger: `top: calc(100% + 4px)`, `z-index: var(--z-popover)`, `--color-surface-raised`, `--color-border-default`, `--radius-lg`, `--elevation-popover`, padding 6px. The source popover is left aligned to its trigger; the mode menu is right aligned to the chevron.
- A popover never leaves the window: the source popover has `max-width: calc(100vw - 16px)` and `max-height: 70vh`.
- The dialog is centred under a backdrop (`--color-scrim-modal`). Its top offset is `--dialog-offset-top` (90px) so it sits under the toolbar, not a padding literal. Width `--dialog-width` (440px). Padding is 16px vertical (`--space-6`) and `--dialog-padding-inline` (18px) inline; gap 12px.

### 3.9 Display scaling and text enlargement (Approved test matrix; zoom recorded as unsupported, Q-5)

Two different things are called "scaling". They are tested separately.

| Condition | Layout viewport (CSS px) | Result | Requirement |
| --- | --- | --- | --- |
| 100%, minimum window | 1024 x 640 | Toolbar and status bar as in range C. Status bar: 8 items, `Uncalibrated` visible (F0 mechanism). Measured. | Required |
| 100%, default window | 1440 x 900 | Range A. Measured. | Required |
| 100%, 1180 | 1180 x 900 | Range C. Measured. | Required |
| **Desktop display scale 125%, 150%, 200%** (the desktop's scale factor, logical window size unchanged) | Unchanged | Layout identical. The device pixel ratio rises (1.25 to 2); the canvas uses `devicePixelRatio`. 1px borders and 2px focus rings are rendered at fractional device pixels and may look soft. | Required: identical layout. **Re-measure**: crispness of 1px lines and the focus ring in WebKitGTK. |
| **Webview text enlargement 125%** of the minimum window (CSS viewport 819px) | 819 x 640 | Measured before 040: toolbar fits (source name about 123px). Status bar: `Unit` and `Uncalibrated` are cut today; with the F0 mechanism they stay and whole items are removed. | Follows F0 (implemented). Not a commitment: zoom is unsupported (Q-5). |
| **Webview text enlargement 150%** (CSS viewport 683px) | 683 x 640 | Measured before 040 (the toolbar then held the source button and the capture control): no overlap, the source name truncated with an ellipsis. Status bar drops three items (Noise floor, Rate, Frame) and keeps 7. Side panel intact. Not re-measured after 040. Measured by simulation (below). | Unsupported (Q-5) |
| **Webview text enlargement 200%** (CSS viewport 512px) | 512 x 640 | Measured before 040 (toolbar then held the source group). Status bar drops FFT and Avg as well and keeps 5 items (Center, Span, RBW, Unit, Uncalibrated). Side panel intact. Not re-measured after 040. Measured by simulation (below). | Unsupported (Q-5) |

Note: in a webview, enlargement changes the CSS viewport, so the 819, 683 and 512 rows are exactly what the
user gets at 125%, 150% and 200% of a 1024px window. The 683 and 512 rows were measured by simulation in WebKitGTK
(work 012, QA round 2): the root element was given a CSS `zoom` at a 1024px window. This is not webview zoom, and
the media queries were not re-evaluated (they still saw 1024px; the only breakpoint that applies is 1180px, already
on at 1024px). Webview zoom keys (Ctrl+=, Ctrl+Shift+=, Ctrl+0) do nothing in this build, so the webview cannot be
enlarged from the keyboard (Q-5).

### 3.10 Rhythm (Approved)

No column grid. Vertical rhythm is 8px between controls in a panel, 12px between sections in a dialog, 4px between a label and its field in a stacked form. Horizontal alignment comes from the fixed label and control widths listed above.

---

## 4. Component catalogue

Candidate `src/ui/` components. Presentational: props in, callbacks out; no IPC, store, session, bindings or device knowledge. The staff engineer confirms the final list and file layout. Priority: P1 needed by the current screens and the fixes; P2 needed by the next features; P3 optional. Entries marked **New** were not in draft 1.

| Component | Priority | Replaces today | Status |
| --- | --- | --- | --- |
| `Button` | P1 | `button`, `.primary`, `.small`, `.forget`, `.button-row` | Approved |
| `IconButton` | P1 | `button.icon`, `.source-actions button.icon`, notice dismiss | Approved (24px, F2) |
| `SplitButton` | P1 | `.capture` (main and chevron) | Approved |
| `Field` (label, control, hint, error wrapper) | P1 | `.form-row`, `.param-field`, `.field` | Approved |
| `TextField`, `NumberField`, `FrequencyField` | P1 | `NumberInput`, `FrequencyInput`, `input[type=text]`, `.freq-input` | Approved |
| `Select` | P1 | `select` | Approved |
| `Checkbox` | P1 | `input[type=checkbox]` with label | Approved (24px label, F14) |
| `Badge` | P1 | `.badge`, `.src-badge`, `.plot-badge` | Approved |
| `StatusDot` | P1 | `StatusGlyph`, `.src-dot`, the `FixedItem` inline span | Approved |
| `StatusStrip` | P1 | The status bar items (`StatusBar.tsx` before 009) | Approved (3.4, F0); implemented in 009 (E6) |
| `Banner` | P1 | `NoticeBanner`, `.notice` | Approved (live region per 9.6) |
| `InlineMessage` | P1 | `.hint`, `.help`, `.dlg-note`, `.error`, `.err`, `.dlg-error` | Approved |
| `Menu`, `MenuItem` (radio and plain) | P1 | `CaptureModeMenu`, `.mode-item`, `.mode-heading` | Approved (capture mode only) |
| `Popover` (non-modal, list content) | P1 | `SourceMenu`, `.source-popover`, `.source-item`, `.source-heading` | **New.** Approved in principle; implementation is B1 |
| `Dialog` | P1 | `SourceDialog`, `.dialog-backdrop`, `.source-dialog` | Approved |
| `Section` | P1 | `Section` in `SidePanel`, `.panel`, `.panel summary` | Approved |
| `Table` (readout) | P2 | `.readout-table` | Approved (selection rules 5.3) |
| `Spinner` | P2 | `.spinner` | Approved |
| `LiveRegion` (persistent, visually hidden) | P2 | `.visually-hidden` plus role status | Approved (9.6) |
| `Tooltip` | P3 | native `title` attributes | **New.** Deferred (5.4) |

Note (009): the "Replaces today" column names pre-009 code. The old components (`NumberInput`, `FrequencyInput`) and the old class names (`.dlg-*`, `.src-badge`, `.mode-item` and the rest) are gone from `src/`. Some hook names in `src/ui/hooks/` were reused for new code.

Entries removed from draft 1: `EmptyState` (no definition existed; the empty states use `InlineMessage` with the hint style, or the plot hint, see 5.8).

### 4.1 Button

- **Purpose:** run one action now.
- **Anatomy:** optional leading icon (12px glyph), label, optional spinner (loading), no trailing icon in the toolbar.
- **Variants:** `default` (control fill, default border); `primary` (accent fill, ink teal, semibold); `destructive` (text `--color-danger`, border `--color-border-danger-muted`, transparent fill).
- **Sizes:** `default` (height `--control-height` in the toolbar, about 30px in dialogs); `small` (min height `--control-height-small`, 12px text, padding 2px 8px).
- **States:** default; hover (control-hover fill, hover border; primary: accent-hover); active (press: as hover, no shrink); focus-visible (ring); unavailable (`--opacity-unavailable`, no hover, no pointer); busy (label kept; the spinner takes the 12px icon slot, or overlays a label-only button with the label painted transparent so its name stays; `aria-busy="true"`; width unchanged; `aria-disabled`, not native-disabled, so focus stays; **not dimmed**, because busy is not unavailable, rule U1); error (not a button state: the error is an inline message beside the button).
- **Keyboard:** Enter and Space activate. Tab order follows the visual order; in a dialog the primary action is last.
- **ARIA:** the visible label is the accessible name. A busy button or a button whose action is locked uses `aria-disabled="true"` and ignores the click, so it keeps focus. Native `disabled` is used only when the reason is visible elsewhere on the same screen (9.10).
- **Do:** verbs ("Save", "Connect", "Forget"). One primary action per group.
- **Don't:** red for an ordinary action (red is for destruction and stopping); change the label width when loading.

### 4.2 IconButton

- **Purpose:** a single glyph action (edit, remove, set centre, dismiss).
- **Anatomy:** a glyph (text character or 12px SVG) only.
- **Variants:** `ghost` (transparent; shows its fill on hover; default in rows and tables); `filled` (control fill; inside the popover row actions).
- **Sizes:** minimum 24 x 24px (`--target-min`) in every case. A 20px icon button is not allowed (F2). Measured today: marker `×` 23 x 20px; notice dismiss 22.5 x 20px.
- **States:** as Button, plus the row-reveal state for popover row actions (hidden until the row is hovered or one of its buttons has focus; stays focusable).
- **Keyboard:** Enter and Space. Inside a popover row, Tab reaches each action in order. The row shortcuts F2 (edit) and Delete (forget) apply to the focused row (5.10).
- **ARIA:** `aria-label` is required and names the object: "Edit Bench SA430", "Remove marker M1", "Dismiss". A `title` gives the shortcut ("Edit (F2)").
- **Do:** use the glyph already in use (✎ edit, × remove or dismiss, ⇥ set centre).
- **Don't:** an icon-only action without an accessible name; a glyph whose meaning is not in the name or the tooltip.

### 4.3 SplitButton (capture control)

- **Purpose:** start or stop acquisition, and choose the mode.
- **Anatomy:** main segment (icon, mode label), chevron segment (caret). One group, one ring.
- **Variants:** tone by mode (continuous teal, single violet); stop tone while acquiring (red) for either mode (2.5).
- **Sizes:** height `--control-height`; chevron 26px; main 128px. Fixed. **Full width** (`fullWidth`, the side panel since 040): the group fills the column (305px at a 330px panel), the main segment takes the room (279px) and the chevron stays at the end. The segment widths and the group height do not change with mode or state.
- **Not sticky (decided in 013):** the control scrolls with the side panel and is not pinned while the panel scrolls (3.6).
- **Placement:** the side panel's Measurement group, last item, below Max hold and Min hold (3.6). Before 040 it was in the toolbar.
- **States:** idle; acquiring; no source (main native-disabled, chevron native-disabled; the reason is in the plot hint: "Not connected. Use the source button to connect." (015; was "Choose a source to begin…")); connecting or disconnecting (unavailable; the reason is the plot tag "Connecting…" (8.1)); busy (a command in flight: main `aria-disabled` with progress cursor, at full strength because busy is not unavailable (U1); chevron dimmed as unavailable, reason in its description; Q-23); locked chevron (acquiring: unavailable, focusable, description says "Pause or cancel acquisition to change the mode"); focus (group ring); menu open (chevron `aria-expanded="true"`, brightness 0.92).
- **Keyboard:** Enter or Space on the main segment acts. Tab reaches the main segment, then the chevron. Arrow Down or Up on the chevron opens the mode menu. Escape or Tab closes it and returns focus to the chevron (Tab then continues in document order, 5.1).
- **ARIA:** the main segment's name is the action ("Start continuous acquisition", "Pause continuous acquisition", "Cancel single capture"). The chevron's name is "Capture mode: Continuous". The group is `role="group"` labelled "Capture". The chevron has `aria-haspopup="menu"` and `aria-expanded`. Its reason, when unavailable, is in `aria-describedby`.
- **Live region:** a finished or cancelled single capture is announced once, polite (9.6). A failure is not announced here (the alert banner says it). Continuous acquisition is not announced.
- **Do:** let the icon and the label carry the action. The tooltip describes the result ("the last trace stays on screen").
- **Don't:** amber for pause; one ring per segment; move the control when the state changes; offer the mode change while acquiring.

### 4.4 Field, TextField, NumberField, FrequencyField

- **Purpose:** enter one value.
- **Anatomy:** label (left in the side panel, above the control in dialogs), control, optional unit suffix (muted, after the control), optional hint (below, secondary, 12px), optional error (below, danger, 12px, associated with the control, 5.7).
- **Variants:** `inline` (side panel, label left, 140px control, 90px with unit); `stacked` (dialog and connect form: label above, in the secondary colour, full width; D1); `frequency` (mono, right aligned, SI suffix accepted, 140px inline in the side panel and in a parameter form).
- **Sizes:** toolbar `--control-height` (30px); the side panel's source button and capture control also `--control-height` (30px); panel and dialog `--field-height-compact` (28px).
- **Value text (F17):** the Center and Span values use `--color-text-primary` (they were not primary before 009).
- **Boundary:** `1px solid var(--color-border-input)` (3:1 on every surface it sits on; F15). Focus-visible replaces the border with the ring, offset 1px.
- **States:** default; hover (border `--color-border-hover`); focus-visible (ring); invalid (border `--color-danger` plus the message; never colour alone); unavailable (`--opacity-unavailable`, reason in the description); read-only in use (`--opacity-read-only`, value visible); empty (placeholder in secondary text, e.g. "e.g. Bench SA430"; a placeholder is never the label); no value (Center with no source: the em dash `—`, disabled). Measurement with no source connected: Frequency step and Reference level show `—` and are disabled, like Center (014). A NumberField with no value (`value` null, 014) is an empty control with the em dash placeholder: it is not stepped, commits nothing until a value is typed, and is not marked invalid.
- **Commit rules** (all numeric and frequency fields): Enter commits and keeps focus in the field (9.8); blur commits; Escape reverts to the stored value. An invalid entry is not sent: Enter keeps it visible so it can be corrected; blur reverts it. Commit only when the value changed.
- **While a commit applies** (Source settings parameters in the side panel, Center, Span): the control is read-only (`readonly` on inputs, `aria-readonly` on selects and checkboxes), not native-disabled, so focus stays on it (9.8). ParamForm passes this for every control type (number, frequency, choice, bool, text).
- **Stepping:** ArrowUp and ArrowDown step the value (frequency: a tenth of the span; number: its step). Stepping works only when the field has no draft.
- **Range message:** the tooltip and the inline text say the allowed range in the field's units (for example "Allowed range: 70 MHz – 6 GHz"). Known gap (SA430 run, 015): today an invalid NumberField shows the border and the tooltip only, with no visible message and no range in kHz; the visible message is follow-up issue #48.
- **ARIA:** `aria-label` or a `<label for>`; `aria-invalid` when invalid; `aria-describedby` pointing to the hint or error.
- **Unit announced (014, Approved and implemented; applies to every NumberField with a unit).** The unit is shown after the control and linked to it with `aria-describedby` (visually hidden text, for example `kHz`), so a screen reader announces "Frequency step, kHz". The same applies to Averaging (`traces`) and Range (`dB`). A `choice` option carries its unit in its own text (`-35 dBm`).
- **Do:** show the unit next to every number that has one (dB, traces, MHz). Use mono for frequencies and levels.
- **Don't:** clamp silently; accept a value and show a different one; show a unit that the value does not have.

### 4.5 Select

- **Purpose:** choose one of a short fixed list.
- **Anatomy:** label, native `<select>`, native chevron.
- **Variants:** inline (panel, 28px); toolbar (30px; no instance since 038, when Span moved to the side panel).
- **States:** as Field. Unavailable with the reason in the description (for example "This source has a fixed span"). While a pick is applying, Span is read-only (`aria-readonly`, 4.4), not native-disabled, so focus stays on it (9.8).
- **Keyboard:** native. Do not replace it with a custom listbox unless the list must show more than a line per item.
- **ARIA:** labelled; the current value is the visible text.

### 4.6 Checkbox

- **Purpose:** on or off.
- **Anatomy:** native checkbox, label text, optional colour swatch before the text (the trace it controls: max hold orange, min hold blue). The checkbox comes before the label for every checkbox, including the boolean parameters (T6).
- **Target (F14):** the `<label>` is the target. Its minimum height is 24px (`--control-height-small`), with the text vertically centred. Before 009 it measured 19px; it is 24px now.
- **Accent (F16):** the checked box takes `--color-accent` (teal) through `accent-color`, not the WebKit default blue (accepted by the PM, T6).
- **States:** default; focus-visible (ring on the checkbox); unavailable; checked.
- **Keyboard:** Space toggles.
- **Do:** label the trace with the swatch; the swatch is a hint, the text is the name.

### 4.7 Badge

- **Purpose:** a short fact about an object or the view.
- **Variants:** `chip` (control fill, secondary text, 11px, `--radius-sm`; transport: USB, Serial, Built-in); `tag` (over the canvas, `--color-scrim-chip` fill, border, 11px semibold, caps tracking: LIVE, CAPTURING, HOLD); tones `live` (accent), `waiting` and `stale` (warn), `capturing` (violet), `stopped` and `noSource` (secondary).
- **Sizes:** one. Transport chips use a fixed 64px column; they never grow the row.
- **Long text (work 010):** the text stays on one line. The label ends in an ellipsis inside the pill (`overflow: hidden`, `text-overflow: ellipsis`), never wraps and never runs out of the pill. When the text is cut, the full text is the pill's native `title` (5.9 rule 2); the accessible name is always the full text. A caller's `title` wins.
- **States:** none (a badge is not interactive). Over the canvas it has `pointer-events: none`.
- **ARIA:** text is read as is. The tag is not a live region (9.6).
- **Do:** write the state in words ("No data for 4 s", "HOLD · last data 13:44:46").
- **Don't:** use a badge as a button; use colour alone for the state.

### 4.8 StatusDot

- **Purpose:** the status of a source, next to its name (2.6).
- **Anatomy:** a 10px dot (a text cross for failed) in an 18px cell.
- **Variants:** connected, acquiring, connecting, disconnecting, failed, absent, idle.
- **States:** animated (connecting, disconnecting) or static (reduced motion).
- **ARIA:** `aria-hidden="true"`; the words or the name carry the state.
- **Do:** keep the shape table; a new status gets a new shape before a new colour.

### 4.9 Banner

- **Purpose:** a notice from the session, or from a failed command.
- **Anatomy:** message text (wraps), zero or one recovery button ("Reconnect", "Restart"), dismiss IconButton (`×`, label "Dismiss").
- **Variants:** `warning` (warn tint; acquisition problems such as "Acquisition failed"); `error` (error tint; connection and internal failures); `command` (error tint; a rejected command; dismiss only).
- **States:** shown; dismissed. A recovery button is shown only when the recovery is possible in the current state (Reconnect only when disconnected and a last configuration exists), and is unavailable while another command is in flight.
- **ARIA:** the live region rules are in 9.6. Summary: `role="alert"` only for DeviceLost, AcquisitionFailed and Internal; every other banner is announced politely. The live region container is always in the DOM and the banner is inserted into it.
- **Keyboard:** the recovery button is the first focusable element after the message; dismiss is last. Focus is not moved on show.
- **Do:** say what happened and what to do ("Add your user to the dialout group, then reconnect.").
- **Don't:** truncate the message; add an icon that is the only signal; stack the same message twice; auto-dismiss errors.

### 4.10 InlineMessage

- **Purpose:** text attached to a control or a section.
- **Variants:** `hint` (secondary, 12px, under a section or a control); `note` (secondary, 12px, in a dialog); `info` (info colour, 12px, a state that is not an error); `warn` (warn colour, glyph ⚠); `error` (danger, 12px).
- **Rule:** one inline error size, 12px (F8). An error says what failed and why ("Connection failed: <reason>").
- **Placement:** next to the field or button it concerns, not at the top of the form.

### 4.11 Menu, MenuItem (capture mode) and Popover (source)

Two different things. Draft 1 used one name for both, which is why the source selector used menu semantics it does not have.

**Menu** (command-style choice, `role="menu"`). Used for the capture mode only.

- Anatomy: Popover > heading (caps) > `role="menu"` > items. An item: 18px icon | name (semibold) and description (secondary) | 16px check, visible only on the current item.
- An item without an icon keeps the 18px icon column, empty, so its name, description and check mark stay aligned with the other items (work 010). The column is never hidden.
- Items: `menuitemradio` with `aria-checked`, one checked (the current mode). Names are `aria-labelledby` the name, descriptions `aria-describedby`.
- Keyboard: on open, focus goes to the checked item. Up and Down move with wrap; Home and End go to the first and last item; Enter and Space activate; type-ahead moves to the next item starting with the typed text; Escape closes and returns focus to the trigger; Tab closes and focus continues (5.1).
- Choosing a mode never starts a capture; the store updates when the backend reports the new mode.
- Locked while acquiring: the menu cannot open (the chevron is unavailable); if it is open when acquisition starts, it closes and focus goes to the chevron.
- Placement (since 040): below the capture control in the side panel, right-aligned to the chevron (280px wide, inside the 305px column). When there is no room below inside the window or the panel, it opens above the chevron instead (013: at 200% zoom in a 1024 x 820 window the 268px menu ran 63px past the bottom when it opened below). Focus does not move.

**Popover** (general-purpose, non-modal, list content, `role="dialog"`). Used for the source selection.

- **Width in the side panel (since 040):** the popover is as wide as the source button (305px, `.source-control > .popover-source`), not 360px. The side panel is a scroll box that clips content past its column, so a wider popover could not be fully visible. It opens below the button, has `max-height` 70vh and scrolls inside itself. It opens above the button when there is no room below (the same rule as the capture menu, 013).
- Anatomy: trigger (the source button) > popover (`role="dialog"`, `aria-label="Sources"`) > groups (`role="group"`; the two list groups have a visible caps label, the fixed blocks have an accessible name and a divider only: see below) > lists (`<ul>` > `<li>`) > rows.
- A **row** is a list item with: a select button (the whole line; name, status word, badge, detail), and separate ordinary buttons for the row actions (Edit, Forget). Geometry (ruling, work 009 T9, 2026-11-16; measured in the browser with the real CSS, fallback fonts): the row is `--row-height` (44px) tall and rows are separated by `--row-gap` (3px), so the pitch is 47px, as before 009. Line 1 holds the glyph, the name and the badge (the badge is centred on the name's line, 17px tall). Line 2 holds the status word and the port, in the name column only. The row actions are two 24 x 24 buttons (`--target-min`) in the badge column (`--badge-column`, 64px), centred vertically on the row. They are shown on hover or when one of them has focus; while they are shown, the badge fades to opacity 0 (the transport badge is replaced, not covered). The actions never overlap a visible badge and never overlap line 2 (they sit in the badge column; line 2 is in the name column). The row actions are ordinary buttons with their own names ("Edit Bench SA430", "Forget Bench SA430"). They are not `menuitem`s.
- Why not the other options (measured, row-relative, 24px actions, bottom-anchored under the badge): at 44px the actions top is 4.2px above the badge bottom (overlap); at 48px 2.1px; at 52px 0.09px (touching, and it depends on the line box of the name, so it is not robust). Centring at 44px needs no extra height and has no overlap to measure. 52px would add 8px to every two-line row at rest, which is the most visible change of the three.
- Target size: the actions are real 24 x 24 buttons. The spacing exception (9.9) is not available: the select button's box lies under the actions, so a 24px circle around an action overlaps another target.
- The active source's select button has `aria-current="true"`. It is not a radio: there is no checked state to announce, and a second selection model is not needed.
- Fixed actions (Signal simulator, Add source…, Disconnect) are ordinary buttons in their own group, a `role="group"` named by `aria-label` ("Add a source", "Connection") with a divider above it.
- **The Signal simulator is always offered (015, Proposed).** It is in the fixed block whatever has been used, because it is the fallback source (5.2.10). It is not listed under Your sources. Its row shows the same state words as any row (Connected, Acquiring, Connecting…, Disconnected).
- **Current row while disconnected (015, Proposed).** The selected source's line 2 reads "Disconnected" (state S13). Picking the row connects it again.
- **Ruling (work 009, 2026-11-16): the fixed blocks have no visible heading.** This stays as it was before 009 (no visible change in 009). The list groups ("Your sources", "Detected devices") keep their visible caps label. A visible label for the fixed blocks is a visible change: Deferred to a later work item, not part of 009.
- Keyboard: 5.1 and 5.10. Summary: Tab and Shift+Tab move through the controls in document order; Enter and Space activate; Escape closes and returns focus to the trigger; leaving the popover by Tab or Shift+Tab closes it without moving focus back; Up and Down move between rows and stop at the first and last row (no wrap, accepted T5); Home and End go to the first and last row (implemented in 009, B1; a convenience, not a trap).
- Focus on open: the active row, else the first row (Implemented).
- Locking: while a command runs or the state is transitioning, rows are `aria-disabled` with the status word visible on the row (for example "Connecting…"). A press is ignored.
- Mouse: a press outside the popover and its trigger closes it without changing anything.
- Connect form and Undo: see 5.2 and 5.7.

### 4.12 Dialog

- **Purpose:** a short, modal task (Add / Edit source).
- **Anatomy:** backdrop (`--color-scrim-modal`; a click on it does nothing, so the dialog closes only through Cancel, Escape, Save or Forget, Implemented); dialog (raised surface, `--radius-lg`, `--elevation-modal`, padding 16px vertical (`--space-6`) and `--dialog-padding-inline` inline, gap 12px). Title (lg, bold), fields (stacked), notes, test result, error, footer (Forget at the left; Cancel and the primary action at the right).
- **States:** idle; validating (field error); testing (busy; Cancel stays enabled and discards the result); saving (fields unavailable; Save is busy: `aria-disabled` with its spinner shown and its label kept transparent, so the width is unchanged and the name stays for assistive technology (4.1), at full strength (busy is not unavailable, U1), focus kept, not the native `disabled`; Cancel and Forget are native-disabled while saving, and the busy Save on the same screen is the visible reason, 9.10); error (message above the footer, in the dialog's polite region, 9.6); locked (read-only fields for the connected source, with a note).
- **Keyboard:** focus is trapped inside (modal). Initial focus: the name field (Edit: its text is selected). Escape cancels (not while saving). Enter in a field submits. When closed, focus returns to the element that opened it (the source button).
- **ARIA:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title. Field errors through `aria-invalid` and `aria-describedby`. Notes, owner and mismatch warnings and the save error sit in one always-mounted polite region (`role="status"`, 9.6 rule 1); a warning is never `role="alert"`. The test-result box is always mounted.
- **Do:** footer order: destructive at the left, Cancel, primary at the right. Reserve the height of the test result so nothing jumps.
- **Don't:** nest dialogs; make the destructive action the primary; close on backdrop click while a save is pending.

### 4.13 Section (side panel)

- **Purpose:** group controls in the side panel; collapsible.
- **Anatomy:** `summary` row: title in caps (sm, semibold, secondary), disclosure triangle; body padding `0 12px 12px`, gap 8px.
- **States:** open; closed; focus-visible (ring on the summary).
- **Keyboard:** Enter and Space toggle (native `details`).
- **Do:** one clear title per section. Default open for what is used during a session; closed for set-and-forget settings.

### 4.14 Table (readout)

- **Purpose:** a list of measured values (markers, peaks).
- **Anatomy:** header (secondary, medium), rows (mono, sm), one active row (surface-control), the id column (marker magenta, peak yellow, bold).
- **Rows:** about 27px tall (measured), above the 24px target minimum. The row is a pointer target today; the id cell becomes the keyboard target (5.3, B4).
- **States:** row hover (raised surface); active row (control surface); empty (one secondary row with the reason, e.g. "No peaks above the detection criteria.").
- **Selection:** see 5.3. Single selection only.
- **Do:** keep values mono; show the delta under the value in secondary 11px.

### 4.15 Spinner

- **Purpose:** a command is in progress and the wait is not known.
- **Anatomy:** one glyph, rotating; always with a text label ("Connecting…", "Testing connection…").
- **Reduced motion:** a static ellipsis.
- **ARIA:** `aria-hidden`; the text carries the state; the enclosing region has `aria-busy`.

### 4.16 LiveRegion

- **Purpose:** announce a status change to assistive technology that was not caused by focus.
- **Anatomy:** a visually hidden element with `aria-live`, always in the DOM, filled only for announcements.
- **Use:** the policy in 9.6 decides what is announced. Frames, ticks and continuous acquisition are never announced.

### 4.17 Tooltip (Deferred)

Today every tooltip is a native `title`. The custom tooltip is specified in 5.4 and deferred.

---

## 5. Interaction patterns

### 5.1 Menus, popovers and focus (Approved)

| Behaviour | Menu (capture mode) | Popover (source) | Dialog |
| --- | --- | --- | --- |
| Semantics | `role="menu"`, `menuitemradio` | `role="dialog"` (non-modal), lists and buttons | `role="dialog"`, `aria-modal="true"` |
| Focus on open | The checked item, else the first | The active row, else the first row | The first field (Edit: text selected) |
| Escape | Closes; focus to the trigger | Closes; focus to the trigger | Cancels (not while saving); focus to the opener |
| Tab / Shift+Tab | Closes; focus continues from the trigger in document order | Moves through the popover's controls in order. Leaving the popover (past its last control, or before its first) closes it; focus is **not** returned to the trigger; it continues in document order. | Cycles inside the dialog |
| Arrow keys | Up and Down move with wrap; Home and End | Up and Down move between rows and stop at the ends (no wrap, T5); Home and End (implemented in 009, B1) | Native within fields |
| Type-ahead | Yes (Implemented) | Removed (implemented in 009, B1; Q-18 accepted) | No |
| Mouse press outside | Closes without change | Closes without change | Ignored (backdrop does nothing) |
| Focus trap | No | **No**: a popover is not a trap | Yes |

Rules:

- A popover or menu never traps focus. A trap is allowed only for a modal dialog.
- Escape always returns focus to the trigger when the popover closes, unless focus has already moved to a new place on purpose.
- A menu or popover that becomes unavailable (acquisition starts elsewhere, a command begins) closes; focus goes to its trigger.
- Nothing opens on hover.
- A new popup uses one of the two models above; it does not invent a third.

### 5.2 Source selector lifecycle (Approved for the states and the copy; B3 deferred to the backlog; Q-12, Q-13 and Q-22 as marked)

**5.2.1 Who owns what.** The UI shows the backend's state and never assumes a connection or capture succeeded.

| What is shown | Source of truth | Notes |
| --- | --- | --- |
| Connected, Acquiring, Disconnecting, Disconnected | `SessionStatus.state` (backend, pushed on every change) | Authoritative. The UI adds the "Connecting…" overlay only while it has sent a connect command (`busy = connecting`). |
| The source name on the button and the current row | `SessionStatus.source` once connected. While connecting, the requested source is shown with the status word "Connecting…". | The name is never shown with "Connected" until the backend says so. |
| Failed | UI-local: the last connect command was rejected | Set on failure; cleared on the next pick. The reason is the backend's message, in the banner. |
| Not detected (after a loss) | Backend notice `deviceLost` with state `disconnected` | Shown as the empty ring and "Not detected" on the current row. |
| Not detected (remembered, absent) | UI-derived from the last successful scan | A scan is discovery. It never changes the connection. An absent row is dimmed. |
| New (detected, not remembered) | UI-derived from the scan | Offered to Connect; it becomes remembered only when saved. |
| Your sources | Backend list (`listSources`), changed only by add, edit, forget and undo commands | |
| Detected devices | Backend scan (`discoverAll`), every 3 seconds while the popover is open | One scan at a time. |
| Choose a source | Retired (015). Not shown after start-up: a source is always selected (5.2.10). | Not reachable in the shipped app. Not designed further. |
| Loading | UI: before the first status and the first list have arrived | Proposed for 015 (B3 pulled in): the button shows "Loading…". |

**5.2.2 Lifecycle states.**

| State | Button (side panel) | Popover | Plot | Banner |
| --- | --- | --- | --- | --- |
| S0 Loading (start-up; Proposed for 015, B3 pulled in) | "Loading…" in secondary text; no attention outline; capture unavailable, reason "Loading…" | n/a | Empty; no hint | None |
| S1 Nothing chosen (retired, 015) | Not reachable after start-up: the fallback (5.2.10) always selects a source. | n/a | n/a | n/a |
| S2 Discovering | Unchanged | "Scanning for devices…" line, only until the first scan result when nothing is detected yet. Remembered rows are shown at once. | Unchanged | None |
| S3 Empty | Unchanged | "No new devices found. Plug one in; this list updates automatically." | Unchanged | None |
| S4 Populated | Unchanged | Your sources (present, absent or unknown), New devices, the Signal simulator (always, 015), Add source…, Disconnect (when connected) | Unchanged | None |
| S5 Connecting | Name, glyph pulsing blue, "Connecting…" in the name and tooltip; capture unavailable | Closes when a row is picked (the button shows the state) | Tag "Connecting…" (B8); no trace | None |
| S6 Connected | Name, teal dot, "Connected" in the name | Current row: "Connected" | Hint or held trace, per 6.8 | None |
| S7 Acquiring | Name, teal dot, "Acquiring" in the name | Current row: "Acquiring" | Live, waiting, stale or capturing (6.8) | None |
| S8 Disconnecting | Name, pulsing blue, "Disconnecting…" | Rows unavailable | Tag "Disconnecting…" (B8) | None |
| S9 Connect failed (also at launch, 015) | Name of the requested source, red cross, "Failed" in the name | Row line 2 "Failed" until the next pick | Hint: "Not connected. Use the source button to connect." (S13 copy); the last trace, if any, held (HOLD) | `error`, polite: "Could not connect to <driver>: <reason>" with Reconnect when a last configuration exists. At launch the device stays selected; no simulator is connected in its place (5.2.10, Proposed) |
| S10 Device lost | "Not detected" (empty ring) | Current row "Not detected" | Last trace held (HOLD), not cleared | `warning`, assertive: "<device> was unplugged." with Reconnect when possible. The source stays selected; no other source is connected in its place (5.2.10) |
| S11 Scan error | Unchanged | Note "Could not scan for devices: <reason>" for that driver; other drivers still listed | Unchanged | None |
| S12 Backend unavailable (start-up; Proposed for 015, B3 pulled in) | "Status unavailable" | Remembered list shown only if it loaded | Empty | `error`, polite, with the reason. The button never shows "Choose a source" as if the list were empty. |
| S13 Selected, not connected (new in 015, Proposed) | Name of the selected source, idle dot; accessible name "Source: <name>, Disconnected" | Current row line 2 "Disconnected"; picking it connects | Tag "No source connected" (also over a held trace); hint "Not connected. Use the source button to connect." only while no trace is shown | None |

Note: the cells that cite B3 or B8 (S0, S5, S8, S12 and the plot and status copy) describe the target. The shipped copy and states are recorded in section 14 until those backlog items ship.

**5.2.3 Discovery, identity and duplicates.**

- Only available drivers are listed. Planned drivers are never shown and cannot be connected (`docs/sources.md`).
- A detected device whose driver and device id match a remembered entry is not listed again as detected.
- A remembered entry that knows only its port is matched to a detected device at the same port. One device gives one row.
- Presence is `present`, `absent` or `unknown`. A remembered entry is `absent` only after a successful scan of its driver did not list its device id. It is `unknown` when the driver cannot discover or the scan failed. `unknown` renders like idle.
- A connection test that identifies a device already in Your sources blocks Save: "⚠ This device is already in Your sources as "<name>"." (Implemented.)
- A connection test that identifies a different serial than the one stored shows: "⚠ Different device: serial <new>, this source is <old>. Saving binds this source to serial <new>; its name and settings are kept." Save is allowed. (Implemented.)
- Names: trimmed, 1 to 60 characters, unique case-insensitively among remembered sources. Errors: "Enter a name.", "At most 60 characters.", "A source with this name already exists."

Devices without a serial number, and two devices that report the same id, are defined by ADR 0010, decision 1 (Q-13: the staff engineer answered in `plan.md` section 9; no change in 009). A device without a serial gets `port:<port name>` as its id, which is unstable and labelled with the port. Two ports that report the same serial both get `port:` ids, so ids never collide. Matching uses `driverId + deviceId`. The UI shows the backend's identity and never invents one.

**5.2.4 Connection test (Add / Edit dialog).**

- Runs only when the user presses Test connection. It opens the port briefly and asks the device for its identity; it never changes the session state and never connects.
- The backend allows one test at a time and answers within 8 seconds. A busy device or a connect in progress answers "Busy: a connection is in progress. Try again in a moment."
- A port in use by the active source answers "<port> is in use by the active source. Stop and disconnect it first." (in use: true).
- Results: idle (dashed box, "Not tested. Test connection opens the port briefly and asks the device for its identity; your current source is not affected."); running (spinner box "Testing connection…"); ok (teal box, "✓ Connection OK. <driver> found.", the serial, and "matches this source" or the warning in 5.2.3); failed (red box, "✕ Test failed: <backend message>", verbatim).
- Editing a field resets the result to idle. A result that arrives after the dialog closed is discarded.
- **Cancel during a test** closes the dialog and discards the result. The backend test finishes or times out on its own; a new test during that time reports "Busy". (Implemented.)
- Retry: press Test connection again.

**5.2.5 Connect, cancel and retry.**

- A connect has no cancel control (Implemented). It ends by success, by failure, or by the backend's open timeout (30 seconds). Escape does not cancel a connect that is in progress. Cancelling a connect is Deferred (Q-12).
- Retry paths: Reconnect in the banner (only when disconnected and a last configuration exists); pick the row again; Restart in the banner (after an acquisition failure, while connected).
- Reconnect uses the remembered entry when it still exists, otherwise the last configuration (Implemented).

**5.2.6 Switching source while a capture is active (Q-22: option B, backlog).**

- Today (Implemented): the rows stay enabled while acquiring. Picking another source sends a connect. The backend stops the acquisition, the held trace and waterfall are cleared (the frame store clears when the state becomes connecting), and the new source connects. There is no confirmation.
- Options: **A** keep as today, with the consequence written in the popover (one line, secondary, while acquiring: "Picking another source stops the acquisition."); **B** other rows unavailable while acquiring, with the reason on the popover header ("Pause to change source"); **C** an inline confirmation before the switch.
- Designer's recommendation: **B**. The user pauses first, which is explicit, and the trace is not lost by accident. Decision (PM, work 009): **B**, as a backlog work item with B3 and B8. Until it ships, option A (today's behaviour) stays and B is Deferred.

**5.2.7 Device disappears during acquisition.**

- A fatal read error or the device watcher ends the session: the backend reports `deviceLost` and state `disconnected`. The plot keeps the last trace with the HOLD tag (it is not cleared). The button shows "Not detected". The assertive banner says "<device> was unplugged." and offers Reconnect when possible.
- A non-fatal read error stops the acquisition and keeps the connection (state `connected`): the banner says "Acquisition stopped: <reason>" (or "Single capture failed: <reason>") and offers Restart. (Assertive, see 9.6, because the acquisition stopped unexpectedly.)
- The popover, if open, closes when the state becomes locked (5.1).
- A device that is lost stays the selected source (Not detected). The app does not connect the simulator in its place (5.2.10).

**5.2.8 Forget and undo.**

- Forget removes the entry from Your sources and shows an Undo toast for 5 seconds (`UNDO_FORGET_MS`). Undo restores the entry. Forget is not confirmed, because it is undoable (5.5).
- Forgetting the connected source keeps the connection and its name until another source is picked (as today). Forgetting a selected source that is not connected selects the Signal simulator, not connected (Proposed, 015; 5.2.10).
- The Undo button is a normal button in a polite status region (9.6).

**5.2.9 Connect form (inline in the popover).**

- Opened from a detected device that needs parameters, or from an edit. The first required empty field gets focus, else the first field, else Connect.
- Escape goes back to the list, unless a connect is in progress.
- Connect is unavailable until the required fields have a value. A connect error is a polite message beside the form (B2).

### 5.2.10 Start-up and the selected source (015)

- **A source is always selected after start-up (Approved, #46).** The button never reads "Choose a source" after start-up. The selection is the connected source, or the remembered selection while disconnected.
- **Launch with a detected device (Approved, #46).** The device is selected and connected (Connecting… then Connected). The simulator is not connected.
- **Launch with no device (Approved, #46).** The Signal simulator is selected and connected, not acquiring. Nothing starts acquisition (ADR 0014: auto-connect only connects).
- **Launch order.** Loading (S0) until the backend answers, then the connect. The simulator is the fallback only when no device is detected at launch.
- **A device plugged in later replaces a simulator only while it is connected and idle (Approved, #46; human decision at the design gate, Q-28).** Any idle simulator is replaced, whether the launch rule connected it or the user picked it. The device goes through Connecting… to Connected. No banner: the button name and state are the feedback (5.7).
- **A device plugged in while the simulator is acquiring does not interrupt (Approved, #46).** The device appears under Detected devices as New (S4); the user picks it to switch (Q-22).
- **A simulator that is acquiring is never replaced (Approved, #46).** The device appears under Detected devices as New.
- **A detected device that fails at launch stays selected, in Failed (S9, Proposed; Q-27).** No simulator is connected in its place.
- **Disconnect keeps the source selected (Approved, #46).** State S13. Pick the row to connect again.
- **Forget of a selected source that is not connected selects the Signal simulator, not connected (Proposed).** The connected one keeps its name until another pick (5.2.8).
- **The Signal simulator is always offered in the popover's fixed block and is never listed under Your sources (Proposed).** It is the fallback, so it must always be reachable.
- **Focus and popovers.** Auto-connect never moves focus and never closes an open popover; rows update in place (Proposed).
- **Announcements.** Auto-connect is not announced: it is not the user's action (9.6). The source button's name and state are current when focused (Proposed).
- **Start-up copy (Proposed, B3 pulled into 015; Q-30).** "Loading…" while the backend has not answered; "Status unavailable" with its reason when it never does (S12).
- **Measurement and Source settings** while the source is selected but not connected: 3.6 (kind rows), 8.2 (copy).

### 5.3 Readout tables and measurement selection (Approved for single selection; B4 and the peak coupling, Q-7, are deferred to the backlog)

**Today (Implemented).** Marker rows are clickable (`cursor: pointer`) and not keyboard reachable. A click on a marker row makes it the active marker. The ⇥ button (only when the source can be tuned) sets the centre frequency to the marker: this changes the hardware tuning and is a command, not a view action. The × button removes the marker. A peak row is clickable: a click toggles the selected peak and also places the active marker at the peak frequency.

**Selection model (Approved):**

- **Single selection.** The active marker (markers) and the selected peak (peaks) are each one item. Multi-selection is not supported and is Deferred: nothing in the app needs it.
- The selected marker is the active marker: a white dashed line and white diamond on the plot (6.6). The selected peak is white on the plot (6.6).
- There is no selection state in the peak table other than the selected peak. The peak table's own selection is independent of the active marker, but today the peak click also moves the active marker (see the coupling below).

**Keyboard (Deferred, B4; backlog).**

- The id cell (`M1`, `P1`) of each row becomes a button. Tab reaches it. Enter or Space selects that row. The row's other buttons (⇥, ×) follow in order.
- Up and Down arrows are not needed: four markers and a few peaks are in Tab order.
- The peak id button: Enter selects the peak. The coupling below applies.

**Coupling of peak selection and the active marker (Q-7: kept as it is in 009; the split is in the backlog).** Today a click on a peak row also places the active marker at that frequency. The designer recommends separating them: the peak row selects (highlight only); a separate "Place marker" button places the marker. Keeping the coupling is acceptable if the human prefers it.

**What happens when a selected measurement disappears or updates (Approved unless marked):**

| Event | Result |
| --- | --- |
| The active marker is removed | The next remaining marker becomes active; with none left, no marker is active (Implemented: `removeMarker`). Marker deltas (Δ vs M1) disappear when M1 is removed. |
| A marker is outside the current span (after a retune or a zoom) | The row stays. Its level shows "—". Its line and diamond are not drawn (6.6). |
| A marker's frequency is changed by ⇥ | Its frequency is updated; the row is not reordered. |
| A peak is no longer in the current frame | The selected peak is cleared (Deferred, B4). Today the stale selection stays until a peak appears at the same frequency. |
| Peaks reorder between frames | Each frame ranks its peaks by amplitude. The P-number is that frame's rank, not a persistent identity (6.6). The selected peak is followed by frequency, not by its number. |
| Values update | In place, at 4 Hz at most (7.2). No animation. Rows are not reordered by value. |

### 5.4 Tooltips and reasons (Approved rules; custom tooltip Deferred)

**Today (Implemented).** Every tooltip is a native `title` attribute (source button, capture control, marker and peak controls, status bar items, popover rows, Edit and Forget). The native tooltip's appearance time is set by the platform and is not configurable. It is not shown on keyboard focus in general.

**Rules (Approved):**

1. A `title` carries supplementary text only: a shortcut ("Edit (F2)"), a description of a status item, a full name that is cut visually.
2. **A reason for a control being unavailable is never only in a `title`.** It is in the control's accessible description (`aria-describedby`) and is visible on the screen somewhere (the plot hint, the plot tag, the status bar, or a visible note). A keyboard user who cannot see a tooltip still gets the reason.
3. A title never carries the only copy of a state. The state is shown visibly and in the name.
4. A truncated value (a long source name, a long port) has its full text in the `title` and in the accessible name. The truncation is visible; the full text is not required to be visible.
5. Touch: not a supported input in this release (Q-14). No touch-only behaviour is defined.

**Custom tooltip (Deferred; the specification is ready if the human adopts it).**

| Property | Value |
| --- | --- |
| Show on hover | After 600 ms. |
| Show on keyboard focus | Immediately, for focus-visible only. |
| Hide | On pointer leave, on blur, on Escape, when the trigger is pressed. |
| Persistent and hoverable (WCAG 1.4.13) | Stays while the pointer is over the tooltip; does not hide on its own. |
| Content | One or two lines of plain text. Maximum width 280px. Long text wraps at word boundaries. No interactive content. |
| Placement | Below the trigger, aligned to its start edge. Flips above when there is no room below. |
| Collision | 8px from the window edges; the tooltip moves inside the window before it flips. |
| Semantics | `role="tooltip"`; the trigger has `aria-describedby` pointing to it, always in the DOM when the trigger is in the DOM. |
| Touch | Not defined (Q-14). |
| z-index | `--z-tooltip` |

### 5.5 Other interaction patterns (Approved as rules for when they are used; no instance is added by work 009)

| Pattern | Used today? | Rule when used | Status |
| --- | --- | --- | --- |
| Segmented control | No | `role="radiogroup"`; the selected segment is checked; Left and Right move and select; one tab stop (roving); segments at least 24px; visible labels. | Deferred |
| Tabs | No | Arrow keys move between tabs; the selected tab is the only tab stop; the panel is labelled by its tab. Automatic activation only when the content is already loaded. | Deferred |
| Context menu | No (no right-click action exists) | `role="menu"`; opened by Shift+F10 or the Menu key and by a right-click; every item is also reachable by a visible control. No action is only in a context menu. | Deferred |
| Confirmation dialog | No | Used only for an action that cannot be undone. The primary button names the action ("Forget source"); Cancel is focused first; Escape cancels; focus returns to the opener. Undoable actions use an undo toast instead (Forget today). | Deferred. Forget keeps its undo toast (Implemented). |
| Progress: indeterminate | Yes (connect, test, scan) | A spinner with a text label; the region has `aria-busy`; reduced motion shows an ellipsis. | Approved |
| Progress: determinate | No (the backend reports no fraction) | Only a value the backend reports may be shown as a percentage or a bar. A made-up progress bar is not allowed. Single capture shows no progress. | Approved |
| Shortcut hint | Yes (titles; the user guide) | Shown in the `title` and in the user guide, never inside the button label. The shortcut list is in 5.10. A shortcut never takes a key a focused text field uses. | Approved |

### 5.6 Forms and numeric and frequency input (Approved)

See 4.4. Commit on Enter and blur, revert on Escape, keep an invalid entry visible until corrected, show the range in the field's units, never clamp silently.

Connect forms (inline in the popover) use the same fields. Required fields are marked with a danger asterisk. The first empty required field gets focus. Escape goes back to the list (5.2.9).

### 5.7 Banners and notices (Approved; live regions per 9.6)

- One banner per cause. A failed connect is reported once: its notice is shown, and the command error for the same cause is not repeated (Implemented in `NoticeBanner`).
- Severity: `warning` for a running problem the user can act on (Restart); `error` for a failed operation (connect, internal); `command` for a rejected command.
- Each banner has a dismiss button. Recovery buttons show only when the recovery is possible in the current state.
- Do not auto-dismiss errors. Success is shown by the state, not by a banner.
- Assertive is used for DeviceLost, AcquisitionFailed and Internal (9.6). Everything else is polite.

### 5.8 Empty, loading, error, unavailable and disconnected states (Approved; corrections marked)

Every screen answers the question "what is happening and what can I do" in words.

| Area | State | Shown | Copy (exact) | Rule |
| --- | --- | --- | --- | --- |
| Source button | Loading (start-up) | Secondary text | Loading… | Proposed for 015 (B3 pulled in) |
| Source button | Nothing chosen | (retired, 015) | Not reachable after start-up | 5.2.10 |
| Source button | Connecting | Pulsing blue dot | Connecting… | Name and tooltip carry the state |
| Source button | Connected | Teal dot | Connected (in the name) | |
| Source button | Acquiring | Teal dot | Acquiring (in the name) | |
| Source button | Failed | Red cross | Failed (in the name) | Reason in the banner |
| Source button | Not detected | Empty ring | Not detected (in the name) | |
| Source button | Selected, not connected (S13, 015) | Idle dot, name | Disconnected (popover row line 2; accessible name) | Proposed (015). The plot tag and the status bar carry "No source connected" on screen |
| Capture | No source | Unavailable, native disabled | Reason: plot hint "Not connected. Use the source button to connect." (S13), or "Connect a source first" in the control's description | Visible reason exists (4.3). The old hint "Choose a source to begin…" is retired (015) |
| Capture | Connecting or disconnecting | Unavailable | Reason: plot tag "Connecting…" / "Disconnecting…" (B8) | |
| Capture | Busy (a command) | Main `aria-disabled`, progress cursor, full strength (U1); chevron dimmed (Q-23) | Tooltip: "Wait for the current change to finish" (chevron); description on both | |
| Plot | Connected, continuous, no frame | Hint, centred | "No trace yet. Press Continuous to start acquisition." (was "Press Play to start continuous acquisition.") | C1 (Q-2), implemented in 009 |
| Plot | Connected, single, no frame | Hint | "No trace yet. Press Single for one sweep." (was "Press Play for one sweep.") | C1 (Q-2), implemented in 009 |
| Plot | Acquiring, no frame yet | Amber tag | Waiting for data… | Only before the first frame |
| Plot | Live | Teal tag | LIVE | |
| Plot | Stale | Amber tag | No data for N s | Only when frames stop while acquiring (threshold: Q-11) |
| Plot | Held (not acquiring) | Secondary tag | HOLD · last data hh:mm:ss | The trace stays on screen |
| Plot | Capturing (single) | Violet tag | CAPTURING | |
| Plot | Connecting or disconnecting | Secondary tag | Connecting… / Disconnecting… | Today: "No source connected" (wrong, B8) |
| Plot | No source, no trace | Secondary tag | No source connected | |
| Status bar | No source | One sentence | No source connected. | |
| Status bar | No frame yet, acquiring | One sentence | No data yet — waiting for the first sweep. | |
| Status bar | No frame yet, connected | One sentence | "No data yet — press Continuous to start acquisition." (Single: "press Single for one sweep."; was "press Play") | Q-2, implemented in 009 |
| Status bar | Connecting or disconnecting | One sentence | Connecting… / Disconnecting… (B8) | Today: "No source connected." (wrong) |
| Popover | Nothing remembered, nothing detected | One note | No new devices found. Plug one in; this list updates automatically. | |
| Popover | Scanning | Spinner note | Scanning for devices… | Only until the first result |
| Popover | Scan error | Note | Could not scan for devices: <reason> | |
| Popover | Detected device | Row line 2 | New · <port> | |
| Popover | Absent remembered source | Dimmed row | Not detected · <port> | |
| Popover | Connect form error | Inline, 12px | Connection failed: <reason> | Polite (B2) |
| Dialog | Test not run | Dashed box | Not tested. Test connection opens the port briefly and asks the device for its identity; your current source is not affected. | |
| Dialog | Test running | Spinner box | Testing connection… | |
| Dialog | Test ok | Teal box | ✓ Connection OK. <driver> found. | |
| Dialog | Test failed | Red box | ✕ Test failed: <backend message> | Polite (B2) |
| Dialog | Source active | Note | This source is connected. The name changes now; connection settings are locked until you disconnect. | |
| Banner | Connection failed | Red banner, Reconnect | Connection failed: <reason> | Polite |
| Banner | Device unplugged | Warning banner, Reconnect | <device> was unplugged. | Assertive |
| Banner | Acquisition failed | Amber banner, Restart | The backend's message, shown as received | Assertive. The UI does not rewrite the text. |
| Panel | No source (Source settings) | Hint | Connect a source to see its settings. | Proposed (015); replaces "Choose a source to see its settings." |
| Panel | Source has no settings (for example, a connected SA430 after 014: its settings are in Measurement) | Hint | This source has no additional settings. | Unchanged (Q-26) |
| Peaks | Nothing above criteria | Muted row | No peaks above the detection criteria. | |
| Peaks | Peak detection off | Note | Peak detection is off. | Today: the table is hidden. No change (Q-19). |

Loading: a command shows a spinner with its label and marks the region `aria-busy`. Data loading (frames) never shows a spinner; the plot shows the previous trace or the hint.

Error: an error is a fact with a reason. "Connection failed: <reason>", never "Something went wrong". Errors that the user can fix name the fix in the same sentence.

Unavailable: a control that cannot be used says why, in a place the user can see or read (5.4). A control is never simply removed to hide a state, except where the table says it is hidden (the peak table when detection is off).

### 5.9 Long text (Approved; numbers measured)

Long text is designed for, not left to chance.

| Text | Length the design is built for | Where it is shown | Rule |
| --- | --- | --- | --- |
| Source name | Up to 60 characters (dialog limit) | Source button (238px name area in the 305px side panel button, measured in 040), popover name line, dialog field | Ellipsis in the button, the status line and the popover name. Full text in the `title` and the accessible name. |
| Device id | 22 characters (`SA430 08FF41E50F8B3A34`) | Popover row detail (mono); dialog | The detail truncates first (ellipsis). The full value is in the `title`. In the dialog it is shown in full. |
| Port or path | Long (`/dev/serial/by-id/...`) | Popover detail (mono), dialog | Mono, ellipsis, full value in `title`. |
| Driver name | About 26 characters ("TI SA430 spectrum analyzer") | Dialog, tooltip | Wraps in the dialog. Not shown in the toolbar. |
| Error message | Unlimited | Banners, dialog errors, inline errors | Wraps. `overflow-wrap: anywhere` where a path appears. Never truncated. |
| Hint or note | A sentence or two | Panels, dialog | Wraps. |

Rules:

1. Shrink order: the source button's name first (ellipsis), then the detail in a popover row. The button fills the side panel's column, which is fixed (330px panel), so it does not change with the window.
2. Ellipsis for any single line the user can read in full elsewhere (row name, detail, button name). The tooltip carries the full value.
3. Wrap for any message the user must read (banner, dialog error, hint).
4. Never clip a message at the edge of a container. The status bar removes whole items instead (3.4).
5. Check every screen at 1024px with the 60-character name and the 22-character device id. Measured at 1024px: the side panel is intact (040).

### 5.10 Keyboard map (Approved; B1 items implemented in 009)

| Key | Where | Action |
| --- | --- | --- |
| Ctrl+K | Window | Open the source popover (Implemented, `App.tsx`) |
| Arrow Down | Source button | Open the source popover and focus its active row (Implemented) |
| Arrow Up or Down | Capture chevron | Open the capture mode menu (Implemented) |
| Enter or Space | Button, row, menu item | Activate |
| Tab, Shift+Tab | Popover | Move through its controls; leaving the popover closes it (B1) |
| Up, Down | Popover rows | Previous or next row (implemented, B1) |
| Up, Down | Capture mode menu | Previous or next item, with wrap (Implemented) |
| Home, End | Capture mode menu; popover (implemented, B1) | First or last item or row |
| Letters | Capture mode menu | Type-ahead (Implemented). In the popover: removed (implemented, Q-18). |
| Escape | Menu, popover, dialog | Close; focus returns to the trigger or opener (dialog: not while saving) |
| Arrow Left, Right | Popover row | Between the row's select button and its actions (Implemented, B1; its E2E check is red on main, a pre-existing failure tracked in GitHub issues) |
| F2 | Popover row (focused) | Edit the source (Implemented) |
| Delete | Popover row (focused) | Forget the source; Undo for 5 seconds (Implemented) |
| Enter | Number or frequency field | Commit |
| Escape | Number or frequency field | Revert the draft |
| Arrow Up, Down | Frequency or number field (no draft) | Step by the field's step (Implemented) |
| Enter | Connect form | Connect |
| Escape | Connect form | Back to the list (not while connecting) |
| Ctrl+wheel, wheel, drag, double-click | Plot | See 6.10 (pointer only today; keyboard equivalents Deferred) |

A new shortcut is added here and in the user guide. A shortcut must not take a key that a focused text field uses. The shortcuts are not shown inside button labels.

---

## 6. Spectrum visualisation

The spectrum plot is the instrument's main interface. This section is the specification for the canvas
(`src/plot/spectrumRenderer.ts`, `src/components/SpectrumView.tsx`) and the waterfall
(`src/components/WaterfallView.tsx`). Canvas internals (how the lines are drawn) are not changed by work 009
(story scope); the rules here describe what is drawn and what the user can do.

### 6.1 Rules (Approved)

1. **No smoothing, no curve fitting, no interpolation into the trace.** The trace is the bins the backend produced. When zoomed out, each screen column shows the maximum of the bins it covers (a peak detector, so narrow signals keep their height). When zoomed in, every bin is a vertex. The only interpolation is the one the instrument needs: the marker level (6.6) and the cursor's trace value (6.7), both documented in `docs/dsp.md`.
2. **No implied accuracy.** A value that is an estimate says so (peak frequency and level are interpolated estimates). A value outside the data is "—", never a number from the edge.
3. **Stable axes.** The frequency axis follows the frame's centre and span, and the user's zoom. The amplitude axis is set by the user (reference level and range). **It never auto-scales to the data.** The axis changes only when the user changes it or the acquisition axis changes (retune, span).
4. **Measurement data is never drawn differently from the data it describes.** Stale or held data is drawn in the held colour with its tag; it is not dressed as live. A hold trace is the backend's hold, not a UI fill.
5. **No animation on data.** Traces and readouts change on the frame, with no transition.
6. **Every number on the plot has a text twin.** The canvas is `role="img"` with an accessible name that gives the span and unit. The marker, peak and status readouts carry the same numbers as text.
7. **Units on every amplitude.** The axis unit and the readout unit come from the frame's unit (`dBFS`, `dB`, or `dBm` only with a calibration).

### 6.2 Anatomy and geometry (Approved; values measured in code)

| Part | Geometry (`src/plot/theme.ts`, `spectrumRenderer.ts`) |
| --- | --- |
| Plot insets | Left 64px (amplitude labels and unit), right 14px, top 10px, bottom 26px (frequency labels). The waterfall uses the same left and right insets so the two align. |
| Plot frame | 1px `--color-grid-strong` rectangle around the plot area |
| Background | Canvas `--color-surface-app`; plot area `--color-surface-plot` |
| Frequency ticks | At most `floor(plot width / 110)` ticks (at least 2), at nice steps (1, 2 or 5 times a power of ten) |
| Amplitude ticks | At most `floor(plot height / 36)` ticks (at least 2), at nice steps |
| Unit label | Rotated 90°, centred in the left inset at 14px from the left edge |

### 6.3 Traces (Approved; line-style differentiation in 6.4 deferred, Q-9)

Drawn in this order, bottom to top: min hold, max hold, live trace (the live fill sits under the live trace).

| Element | Token | Line | Fill | Drawn when | Words that accompany it |
| --- | --- | --- | --- | --- | --- |
| Live trace | `--color-trace-live` (teal-400) | Solid, 1.25px | `--color-trace-live-fill` under the line | Live (6.8) | Tag `LIVE` |
| Held trace (stopped, or after a loss) | `--color-trace-stale` (slate-500) | Solid, 1.25px | None | Stopped, device lost | Tag `HOLD · last data hh:mm:ss` |
| Stale trace (last data, no new frame for 2 s while acquiring) | `--color-trace-stale` | Solid, 1.25px | None | Stale | Tag `No data for N s` |
| Max hold | `--color-trace-max-hold` (orange-400) | Solid, 1px | None | Max hold on | Legend swatch and label "Max hold" in Measurement |
| Min hold | `--color-trace-min-hold` (blue-400) | Solid, 1px | None | Min hold on | Legend swatch and label "Min hold" |

Notes:

- Hold traces (max and min) keep their colours when the live trace is held. Only the live trace changes colour.
- Hold traces are computed by the backend and restart when the frequency axis, the bin count, the window or the unit changes (`docs/dsp.md`). Values from different settings are never mixed.
- Averaging (power average, then exponential moving average) is a backend processing setting shown in the Measurement panel. The UI does not smooth.

### 6.4 Trace differentiation without colour (Approved for the words; line styles deferred to the backlog, Q-9)

- **Approved (Implemented):** each state has a word on the plot tag (6.8). Markers and peaks have shapes and labels (6.6). The hold traces have a legend in the panel with a swatch and a name.
- **Deferred (P9, Q-9; backlog):** max hold dashed (`[6, 3]` px) and min hold dotted (`[2, 2]` px), so the three traces differ by line style as well as colour. Today the three traces differ by colour only. Their luminance contrast with each other is low (orange against teal 1.22:1; blue against teal 1.47:1). This changes the canvas and is a separate work item.
- The live trace is the thickest line. Its fill is a second cue.

### 6.5 Grid, axes and labels (Approved; one Deferred rule)

| Element | Token | Status and contrast |
| --- | --- | --- |
| Grid lines | `--color-grid` (14% light) | **Decorative.** Its contrast is 1.22:1; it is exempt from non-text contrast because it carries no information on its own: every grid line has a labelled tick. Do not put information only in grid lines. |
| Strong grid line at 0 (when the 0 tick is on the axis) and the plot frame | `--color-grid-strong` (28%) | Decorative (1.59:1) |
| Tick labels (frequency and amplitude) | `--color-text-axis` (slate-350), 11px | Text: 6.86:1 on the plot |
| Unit label | `--color-text-axis`, 11px, rotated | Text: 6.86:1 |

Label rules:

- **Amplitude** labels are plain numbers at the tick (`-20`, `0`), with the unit once on the axis.
- **Frequency** labels use the unit of the tick value and the decimals of the tick step, so each label has a constant number of decimals. The edge labels are kept inside the canvas.
- **Deferred (P11, backlog):** one frequency unit for the whole axis. Today each label picks its own unit, so an axis that crosses 1 GHz can show `999.5 MHz` and `1.0000 GHz` side by side. The unit is chosen from the span (or the centre) and used for every label on the axis.

### 6.6 Markers and peaks (Approved)

**Markers.**

| Property | Value |
| --- | --- |
| Count | Up to four (`MAX_MARKERS`). Ids 1 to 4; a removed id is reused. |
| Colour | `--color-marker` (magenta-400), all markers |
| Shape | Dashed vertical line (`[3, 4]` px) across the plot; a diamond on the trace at the marker's level; label `M<id>` beside the diamond |
| Active marker | White (`--color-marker-active`): the line, the diamond and the label |
| Level | The live trace read at the marker's frequency by **linear interpolation between bins** (`docs/dsp.md`). The marker is not snapped to a bin. |
| Off the span | Not drawn. Its table level shows "—". The row stays. |
| Delta | Markers 2 to 4 show "Δ" against M1 (frequency and level). With no M1, no deltas. |
| Placement | A click (no drag) on the plot moves the active marker, or creates one. Shift+click adds a marker. "+ Marker" adds one at the centre of the view. |
| Removal | The × button in the table. The active marker moves to the first remaining marker. |
| Set centre | The ⇥ button (only when the source can be tuned) sets the centre frequency to the marker. **It retunes the hardware.** It is a command with its own busy state, not a view action. |

**Peaks.**

| Property | Value |
| --- | --- |
| Detection | Backend. Criteria: height above the noise floor, prominence, optional absolute threshold (`docs/dsp.md`). The UI draws what the frame carries. |
| Shape and label | Yellow (`--color-peak`) triangle pointing at the peak, label `P<rank>` above it |
| Rank | The label is the peak's rank in the current frame, strongest first. **The number is not a persistent identity** (5.3). |
| Overlap | A weaker peak's label is skipped where it would overlap a stronger one. The selected peak's label is always drawn. |
| Selected | White (`--color-marker-active`), set from the peak table |
| Values | Frequency and level are **interpolated estimates** (`docs/dsp.md`). The table shows them with the unit; the prominence in whole dB |
| Peak search | Places the active marker on the strongest peak (Implemented) |
| Next peak | Places the active marker on the next weaker peak (Implemented) |

Contrast: magenta is 7.17:1 on the plot and yellow 12.70:1 (both 3:1 or more). Magenta and yellow differ in shape and label as well as colour.

### 6.7 Cursor and crosshair readout (Approved; keyboard equivalent Deferred)

- When the pointer is over the plot, a crosshair is drawn: a vertical and a horizontal 1px line in `--color-crosshair` (45% light; 3.83:1 on the plot).
- The readout box (`--color-scrim-readout`, mono 11px, text `--color-text-readout`, 16.50:1) shows three lines:
  1. the frequency at the cursor (resolution of one screen pixel);
  2. `cursor <level>`: the amplitude at the cursor's row, from the axis;
  3. `trace <level>`: the live trace's value at the cursor's frequency (interpolated between bins), or "—" when outside the data.
- The box moves to the left of the cursor when it would leave the right edge, and stays inside the plot vertically.
- The readout is canvas text. It is not in the accessibility tree. Its numbers are available to keyboard users through the marker table (place a marker) and the status bar (Center, Span). A keyboard cursor is Deferred (9.15, 6.10).

### 6.8 Live, held, stale and unavailable data (Approved; the table is the rule)

The state comes from `src/state/liveness.ts`, evaluated every 250 ms. A stale threshold of 2 seconds is used today (`STALE_AFTER_MS`); whether it is right for slow sweeps is deferred to the backlog (Q-11).

| State (`liveness.kind`) | Condition | Tag text (colour) | Trace | Fill | Readouts (markers, peaks, cursor) | Waterfall | Status bar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `live` | Acquiring (continuous); the last frame is at most 2 s old | `LIVE` (teal) | Live colour | Yes | Current values | Scrolls, one row per frame drawn | Current values |
| `waiting` | Acquiring; no frame yet | `Waiting for data…` (amber) | None | No | "—" | Empty | Sentence: "No data yet — waiting for the first sweep." |
| `stale` | Acquiring (continuous); the last frame is older than 2 s | `No data for N s` (amber) | Stale colour (slate) | No | **Last values, not refreshed** (see the note) | Frozen | Last frame's values |
| `capturing` | Acquiring (single); the sweep has not landed | `CAPTURING` (violet) | The previous trace in stale colour, if any | No | Previous values, if any | Frozen | "Capturing one sweep…" |
| `stopped` (held) | Not acquiring; a frame exists | `HOLD · last data hh:mm:ss` (secondary) | Stale colour | No | Last values | Frozen | Last frame's values |
| `stopped` (no frame) | Connected; no frame | `Stopped` (secondary) | None | No | "—" | Empty | "No data yet — press Continuous…" (Q-2) |
| `noSource` | No source; no frame | `No source connected` (secondary) | None | No | "—" | Empty | "No source connected." |
| Connecting / disconnecting (Deferred, B8) | `connecting` or `disconnecting`; no frame | `Connecting…` / `Disconnecting…` (secondary) | None | No | "—" | Empty | Same words |
| Device lost | Disconnected after `deviceLost`; the last frame kept | `HOLD · last data hh:mm:ss` | Stale colour | No | Last values | Frozen | Last frame's values; the banner says the device was unplugged |

Notes:

- **Stale readouts (Deferred, P12; backlog, prioritised).** The marker table and the peak table keep the last values while the plot says "No data for N s". The values look current. The designer recommends that the readout tables show the same word ("Last data hh:mm:ss") in their section header while the state is not live. This is a small addition, not in work 009; it is the first backlog item to take (roadmap P12).
- A held trace is never extended, cleared or animated. A new frame of a new source clears it (the store clears on a state change to connecting).
- Liveness labels are plain words. They are not announced (9.6).

### 6.9 Waterfall (Approved; legend deferred, Q-10)

- **Rows.** One row per frame drawn, newest on top. The renderer adds at most one row per animation frame; frames that arrive between two animation frames are not drawn and are not queued. Under load the waterfall shows fewer rows than frames received, and its time labels are correct for the rows it shows.
- **Axis.** The frequency view and the amplitude range are shared with the spectrum (same zoom, same reference and range). The time axis is labelled `Time ↓`. Ticks every 48px show the age of the row at that height, relative to the newest row: `−2.4 s` below 10 seconds, `−12 s` above.
- **Colour.** A lookup table over `[reference − range, reference]`. Levels above the range take the top colour; below the range the bottom colour; no data (NaN) takes the bottom colour. Palettes: `classic`, `viridis`, `grayscale` (Display panel). The palette stops are data encodings and stay in `src/plot/colormap.ts` (2.18).
- **Dynamic range.** The range is 10 to 200 dB (default 120 dB); the reference is −200 to 100 (default 0), in the frame's unit. These are the same limits as the spectrum.
- **Clearing.** The history is cleared when the zoom, reference, range or palette changes, and when the source changes. It is not cleared on pause. A paused waterfall stops scrolling and keeps its rows.
- **No tag.** The waterfall has no state tag; the spectrum's tag applies. (A dimmed or tagged waterfall is not proposed.)
- **Legend (Deferred, Q-10; backlog).** Today the waterfall has no colour scale, so its levels cannot be read from it. The proposal is a thin vertical colour strip at the right of the waterfall, labelled with the reference (top) and the bottom of the range (bottom) in the frame's unit, using the same LUT. It is a small new element and is not in work 009.

### 6.10 Interactions (Approved for the Implemented rows; the others as marked)

| Interaction | Status | Behaviour |
| --- | --- | --- |
| Click (no drag) on the plot | Implemented; Approved | Places the active marker, or creates one. Needs a frame; does nothing when there is no frame. |
| Shift + click | Implemented; Approved | Adds a marker (up to four; does nothing when all are used). |
| Hover (cursor) | Implemented; Approved | Crosshair and readout (6.7). |
| Wheel over the plot | Implemented; Approved | Zooms the frequency axis about the cursor. Each step is a factor of 1.25 (out) or 0.8 (in). The narrowest view is eight bins. Zooming to the full span clears the zoom. |
| Wheel over the level axis (left inset) | Implemented; Approved | Moves the reference level by 5 dB per step. |
| Ctrl + wheel | Implemented; Approved | Changes the displayed range by a factor of 1.25 (out) or 0.8 (in), within 10 to 200 dB. |
| Drag (more than 3px) | Implemented; Approved | Pans the frequency view. The drag does not place a marker. |
| Double-click | Implemented; Approved | Resets the zoom to the full span. |
| Zoom reset button | Implemented; Approved | Visible while zoomed: "Zoom: <span> · reset". Target 24px (F13). |
| Drag to select a frequency range (zoom to box, band measurement) | **Rejected for this release** | No feature needs it; it would add a second drag meaning next to pan. Reconsider with a feature. |
| Keyboard: move the active marker (Left, Right by one bin; Shift for ten bins) (Q-8) | Deferred | Spec for the future: the plot takes keyboard focus (`tabindex="0"`); the active marker moves; the readout updates; a visible focus ring is drawn around the plot. |
| Keyboard: zoom (+ and −, 0 for full span) (Q-8) | Deferred | Same focus model; the zoom is about the view centre. |
| Right-click menu | Deferred | No right-click action exists (5.5). |
| Touch (pan, pinch) | Deferred (Q-14) | The canvas uses pointer events and `touch-action: none`; touch behaviour is not defined. |

### 6.11 Transitions between capture states (Approved)

| Transition | What the user sees |
| --- | --- |
| Disconnected to connecting | Frame and waterfall cleared; tag "Connecting…" (B8); no trace. |
| Connecting to connected, no frame | Hint for the mode ("No trace yet. Press Continuous…"). Tag "Stopped". |
| Connected to acquiring, continuous | Tag "Waiting for data…" (amber), then "LIVE" (teal) with the first frame. The trace appears at once; no fade. |
| Continuous, frames stop | After 2 s: "No data for N s" (amber); the trace is drawn in the stale colour. Nothing is erased. |
| Continuous, stop or pause | Tag "HOLD · last data hh:mm:ss"; the trace is drawn in the stale colour with no fill. |
| Single capture, start | The previous trace (if any) is drawn in the stale colour; tag "CAPTURING" (violet). |
| Single capture, sweep lands | The sweep is drawn in the stale colour (a single capture is never live, 6.8) and tagged HOLD as the state returns to connected. Announced once, politely (9.6). |
| Single capture, cancelled | The previous trace stays (in the stale colour); the cancelled state is announced once, politely. |
| Retune (centre or span changes) | The frequency axis follows the new frame. A user zoom is reset to the full span (Implemented). The waterfall is cleared. Markers keep their frequencies; those outside the span show "—". |
| Reference or range changed | The axis changes at once; the waterfall is cleared. |
| Source switch | The frame, waterfall and zoom are cleared. Markers keep their frequencies (Implemented). |
| Device lost | Trace held (HOLD); banner (assertive). |

### 6.12 What the UI must never do (Approved)

- Smooth, interpolate between bins for display, or fit a curve to a trace.
- Auto-scale the amplitude axis.
- Show a peak, marker or level as a number when the data does not contain it (show "—").
- Show a held or stale trace in the live colour or without its tag.
- Show a value from the frame as current when the plot is not live, without the tag.
- Label uncalibrated data `dBm`, or show a calibration that does not exist.
- Animate traces or readouts between frames.
- Draw a made-up trace, marker or peak in the demo, the placeholder or the prototype as if it were data.
- Hide that a trace runs above or below the displayed range. (Edge markers for over-range data are Deferred, P13; backlog.)

---

## 7. Performance and measurement integrity

### 7.1 Data path (Implemented; ADR 0003)

- The backend encodes each frame once and keeps only the latest. The UI pulls with `next_frame(after_seq)`, a long poll of up to 500 ms, one request at a time (`src/state/framePump.ts`).
- The frame goes to `frameStore` (`src/state/frames.ts`), a store outside React state. Canvases subscribe and redraw on their own animation frames.
- **No frame is held in React state, in props or in a zustand store.** High-rate data never triggers a React render.
- The frame rate shown in the status bar is the rate of frames received (arrivals over 2 seconds), not the rate drawn.

### 7.2 Render budgets (Approved; values Implemented)

| Consumer | Budget | Source |
| --- | --- | --- |
| Spectrum canvas | At most one draw per animation frame, and only when something changed (a dirty flag) | `SpectrumView.tsx` |
| Waterfall canvas | At most one new row per animation frame | `WaterfallView.tsx` |
| Liveness (tag) | Every 250 ms | `useLiveness` |
| Marker and peak panels | Every 250 ms (`useFrameTick`) | `MarkersPanel`, `PeaksPanel` |
| Status bar | Every 500 ms (`useFrameTick(500)`) | `StatusBar.tsx` |
| Waterfall time labels | Every 500 ms | `WaterfallView.tsx` |
| Source scan (popover open) | Every 3 s, one scan at a time; stops when the popover closes | `sources.ts` |
| Display preferences save | Debounced 600 ms after the last change | `view.ts` |
| Frame request | One outstanding `next_frame` at a time | `framePump.ts` |

### 7.3 Backpressure and frame dropping (Approved; defined behaviour)

- **The backend never queues frames for the UI.** It keeps the latest. The UI asks for the next frame only after it has received one, so there is at most one outstanding request.
- **If the backend produces frames faster than the renderer draws**, the renderer draws the newest frame at its next animation frame. Intermediate frames are dropped, not interpolated and not stored.
- **The waterfall adds at most one row per animation frame**; frames between two rows are dropped. The status bar's Rate shows frames received, so Rate can exceed the rows shown.
- **If the UI is slower than the backend**, latency stays bounded at about one frame. Nothing accumulates.
- **If the backend stops producing frames**, the liveness state changes after 2 seconds (6.8). Nothing else changes.
- **Buffering:** none. There is no client-side history beyond the waterfall rows already drawn, which are bounded by the canvas height.
- **Throttling:** the render budgets in 7.2 cap the cost of every other consumer. No consumer runs per frame except the canvases.

### 7.4 Stable axes and layout (Approved; one Deferred item)

- The frequency axis is fixed by the frame's centre and span. The amplitude axis is fixed by the reference and range. Neither moves with the data (6.1, rule 3).
- The plot insets are fixed (6.2). Status bar items and readouts use mono, so their digits do not change width. Numbers in sans text use tabular figures.
- Status bar items are added or removed by whole items only (3.4). Toolbar items never change size.
- **Avoidable layout shift:** the peak table's growth moves the sections below it in the side panel. **Deferred (B5; backlog):** cap the table body at eight rows and scroll inside.
- **Avoidable layout shift:** a banner that appears above the workspace takes height from the plot. Accepted: a notice is a state change the user must see. Its height is capped by B6.
- No layout depends on a value in the data. A wide value (a 9-digit frequency) fits the fixed columns.

### 7.5 Formatting and units (Approved; the rules are the formatters in `src/format/`)

Three layers, kept apart:

1. **Physical measurement** (the backend's value in the frame's unit: `dbfs`, `db`, or `dbm` with a calibration).
2. **Display formatting** (the functions in `src/format/`: rounding, decimals, unit symbol). The only place numbers become text. Presentational components do not call `toFixed` themselves (a guard is proposed in 10.3).
3. **Calibration-dependent labels** (`dBm` and "calibrated"). Only a calibration produces these. No calibration exists in the app today, so `dBm` is never shown. `Uncalibrated` is shown whenever the unit is not `dbm`.

| Quantity | Format | Example | Source |
| --- | --- | --- | --- |
| Centre (status bar and field) | SI prefix; decimals from the resolution `binHz / 10` | `2.400000 GHz` | `formatFrequency(centerHz, binHz / 10)` |
| Span | SI prefix; resolution 1 kHz | `2.048 MHz` | `formatFrequency(spanHz, 1000)` |
| RBW | SI prefix; resolution 1 Hz | Natural unit | `formatFrequency(rbwHz, 1)` |
| Marker frequency and Δ | As centre; the resolution of the frame | `2.401250 GHz`, `Δ 1.250 MHz` | `formatFrequency(f, binHz / 10)` |
| Marker level | 2 decimals, the unit | `-61.25 dBFS` | `formatLevel(v, unit, 2)` |
| Marker Δ level | 2 decimals, `dB` | `Δ -8.75 dB` | `formatLevel(d, 'dB', 2)` |
| Peak level | 1 decimal, the unit | `-44.3 dBFS` | `formatLevel(v, unit, 1)` |
| Peak prominence | Whole dB | `12 dB` | `toFixed(0)` |
| Cursor and trace readout | 1 decimal, the unit | `trace -61.3 dBFS` | `formatLevel(v, unit)` |
| Noise floor | 1 decimal, per bin | `-84.5 dBFS/bin` | `formatLevel(v, unit)` + `/bin` |
| Averaging | Count of traces in the average | `10/10` | Integers |
| Frame | `#seq · hh:mm:ss` (24 h, local) | `#184223 · 13:44:46` | `timestampMs` |
| Rate | 1 decimal, fps | `30.0 fps` | `frameStore.rate` |
| Missing value | An em dash `—` | `—` | `formatLevel`, `formatFrequency` for non-finite values |
| Axis frequency label | Per 7.5 with the step's decimals; one unit per axis (Deferred, P11) | `2.40 GHz` | `formatFrequency(f, step)` |

Units and their meaning (`src/format/units.ts`):

| Unit | Symbol | Meaning | Status bar |
| --- | --- | --- | --- |
| `dbfs` | `dBFS` | Relative to converter full scale (uncalibrated) | Shows `Uncalibrated` |
| `db` | `dB` | Relative level, unknown reference (uncalibrated) | Shows `Uncalibrated` |
| `dbm` | `dBm` | Absolute power, calibrated by the instrument | Does not show `Uncalibrated`. No source produces it today. |

Note: the decimals are a display choice. The measurement keeps the backend's precision; the display never implies more precision than the resolution.

### 7.6 Staleness (Implemented; threshold deferred to the backlog, Q-11)

- Data is "live" only while the backend reports continuous acquisition and frames keep arriving. A frame older than 2 seconds while acquiring is stale (`STALE_AFTER_MS`).
- A single capture is always "capturing" until its sweep lands. It is never live and never stale.
- **Deferred (Q-11; backlog bug):** a fixed 2-second threshold is wrong for a source with a slow sweep, which would show "No data for N s" on healthy data. The frame header does not carry the sweep time today. The fix needs a backend field or a per-source threshold (staff engineer), then a design decision on the wording. This is a bug candidate. The staff engineer's design (`plan.md` section 9): an optional `sweepIntervalMs` in `FrameHeader`, set by the pipeline from the source (SA430: the driver's measured sweep time; simulator: the pacer period), and a threshold of `max(2000, 3 x sweepIntervalMs)`. Not in 009.

### 7.7 Animation and data (Approved)

No animation on data (6.1 rule 5). The only animations are the spinner, the connecting pulse, the row action reveal and the newly saved row highlight (2.13), none of which show measurement values.

### 7.8 Measurement integrity tests (Approved; written in 009 where the item is implemented)

1. The status bar, marker table and peak table format through `src/format/` (a grep test forbids `toFixed` in components).
2. A marker outside the span shows "—" and is not drawn.
3. A stale state is reached after 2 s of no frames, and its tag and trace colour match 6.8.
4. The canvas reads its colours from the token file (Appendix B).
5. The status bar at 1024px shows `Uncalibrated` (regression test, see F0).
6. The amplitude axis does not change when a frame with a different peak arrives (a unit test on the axis function).

---

## 8. Content and copy

### 8.1 Voice and form (Approved)

- Plain, exact, calm. Say what happened, then what to do. No exclamation marks, no blame, no jokes.
- Sentence case everywhere, including buttons and menu items. Caps only through the caps style (group labels, section titles), never typed in capitals.
- Use the visible label of a control in the copy ("press Continuous"), so the words and the button match.
- Use an em dash with spaces (` — `) to join a status and its reason in the status bar. Use a middle dot (`·`) to join parts of one line (`Acquiring · /dev/ttyACM0`, `HOLD · last data 13:44:46`).
- The ellipsis is the character `…` for an action in progress ("Connecting…", "Scanning for devices…", "Testing connection…").
- Errors start with the failure: "Connection failed: <reason>", "Test failed: <reason>", "Could not scan for devices: <reason>".
- Hints say what the control does and how to use it ("Click the spectrum to place a marker (Shift+click adds another).").
- The plot hint (`SpectrumView.tsx`) and the status bar's no-frame sentence come from one copy table (this section), so they do not drift.

### 8.2 Copy that changes (status per row)

| Item | Today | Target | Status |
| --- | --- | --- | --- |
| Mode words in the hints and status bar | "press Play" | "press Continuous" / "press Single" | Done in 009 (Q-2): the button shows the mode name, so the copy matches it |
| Connecting, disconnecting in the plot tag | "No source connected" | "Connecting…" / "Disconnecting…" | Backlog (B8), a bug |
| Connecting, disconnecting in the status bar | "No source connected." | "Connecting…" / "Disconnecting…" | Backlog (B8), a bug |
| Start-up before the first status | "Choose a source" | "Loading…" | Proposed for 015 (B3 pulled in, Q-30) |
| Backend unavailable at start-up | "Choose a source" | "Status unavailable" | Proposed for 015 (B3, Q-30) |
| Selected, not connected: plot hint (015) | "Choose a source to begin. Try Signal simulator." | "Not connected. Use the source button to connect." | Proposed (015, S13) |
| Source settings with no source (015) | "Choose a source to see its settings." | "Connect a source to see its settings." | Proposed (015) |
| Frequency step, Reference level with no source (014) | (in Source settings) | Em dash, disabled, in Measurement, when the source was opened this run; otherwise hidden (follow-up #47) | Proposed (014) |
| Peak detection off | Table hidden | Note: "Peak detection is off." | No change (Q-19: kept hidden) |

### 8.3 Button and menu labels (Approved)

- Verb first for actions: Save, Cancel, Connect, Reconnect, Restart, Forget, Undo, Test connection, Add source…, Peak search, + Marker.
- Ellipsis at the end when the action opens something else (Add source…).
- The capture main segment shows the mode name, not the action. Its accessible name and tooltip say the action.
- Destructive: Forget. Not "Delete" (the Delete key is a shortcut, not the copy).

### 8.4 Units (Approved)

- Amplitudes always show their unit. Power in `dBFS` for IQ-derived spectra, unless a calibration is applied; `dBm` only with a calibration. Never label uncalibrated data `dBm`.
- The status bar shows `Unit dBFS` and `Uncalibrated` (warning text) while the data is uncalibrated. `Uncalibrated` is never removed to save space (3.4).
- Frequencies: SI prefix with the resolution's decimals (7.5). Span and RBW use their natural unit.
- Ratios and differences: `Δ` for a delta; `dB` for relative levels.
- Counts: `traces` after an averaging count; `max` after a peak count.
- Time: local `hh:mm:ss`, 24 h.
- A value is never shown without its unit when it has one.

### 8.5 Glossary (Approved; use these words, only these)

| Term | Meaning in the UI |
| --- | --- |
| Source | A device or the simulator that the app is connected to |
| Your sources | Remembered sources |
| Detected devices | Plugged-in devices not yet remembered |
| Connect / Disconnect | Set up or release the link to a source |
| Continuous, Single | Capture modes |
| Acquiring | The backend is capturing (pause or cancel stops it) |
| Pause | Stop continuous acquisition; the last trace stays |
| Cancel | Stop a single capture before it completes; the previous trace stays |
| LIVE, HOLD, CAPTURING, Stopped | Plot state tags |
| Uncalibrated | Amplitudes are not calibrated (dBFS only) |
| Averaging | Number of sweeps combined into one trace |
| Selected source | The source the app uses. Always one after start-up (015): the connected one, or the last one while disconnected |
| Disconnected | A selected source with no link. Not Stopped, not No source connected (015) |
| Reference level (Measurement) | The SA430 device input level, dBm. It is the device's setting (014) |
| Reference level (Display) | The plot's reference level, in the Display group. It is not the device's setting (014) |
| Frequency step | The SA430's distance between measured points, kHz (014) |

Do not use "Play" in new copy (the button has a Play icon and the mode name; Q-2). Do not use "Stop" for a continuous capture (it is Pause). Do not add a "Scan" button: the popover looks for devices by itself while it is open. Do not write "Live" in lower case as a state.

### 8.6 Known copy drift

Recorded in `design.md` section 5 (copy findings C1 to C5). C1 is the Play copy (Q-2). C4 and C5 are the connecting copy (B8). The user guide's "Play" wording was corrected in work 009 (T12).

---

## 9. Accessibility

### 9.1 Standard and scope (Approved)

WCAG 2.2 level AA for everything in the app, including the canvas chrome. Canvas data (traces, grid, waterfall) is subject to the non-text rules in 9.4 where it is needed to understand content, and must never be the only way to read a value: readouts and tables carry the numbers.

### 9.2 Text size (Approved; corrected)

WCAG 1.4.3 defines large text as:

- **at least 24 CSS px** regular, or
- **at least 18.67 CSS px (14pt) bold**.

Text below that is normal text and needs **4.5:1**. Large text needs 3:1.

Draft 1 said 15px semibold; that was wrong. In this app no text reaches the large-text definition: the dialog title is 15px bold and the plot hint is 15px regular. Both need 4.5:1, and they meet it (table 9.3). Every text rule in this file is therefore 4.5:1.

### 9.3 Text contrast (Approved; computed from Appendix A)

Ratios are WCAG relative luminance, computed from the token values. The test in 2.18 recomputes them.

| Pair | Ratio | Need | Result |
| --- | --- | --- | --- |
| `--color-text-primary` on `--color-surface-panel` | 13.62:1 | 4.5:1 | Pass |
| `--color-text-primary` on `--color-surface-raised` | 12.44:1 | 4.5:1 | Pass |
| `--color-text-primary` on `--color-surface-control` (button label) | 11.09:1 | 4.5:1 | Pass |
| `--color-text-primary` on `--color-surface-control-hover` (hovered button label) | 9.78:1 | 4.5:1 | Pass |
| `--color-text-secondary` on `--color-surface-app` | 6.66:1 | 4.5:1 | Pass |
| `--color-text-secondary` on `--color-surface-panel` | 6.11:1 | 4.5:1 | Pass |
| `--color-text-secondary` on `--color-surface-raised` | 5.58:1 | 4.5:1 | Pass |
| `--color-text-secondary` on `--color-surface-control` (badge, row sub-line) | 4.97:1 | 4.5:1 | Pass |
| `--color-accent` on `--color-surface-panel` | 10.43:1 | 4.5:1 | Pass |
| `--color-warn` on `--color-surface-panel` | 9.95:1 | 4.5:1 | Pass |
| `--color-danger` on `--color-surface-raised` | 5.75:1 | 4.5:1 | Pass |
| `--color-info` on `--color-surface-panel` | 7.12:1 | 4.5:1 | Pass |
| `--color-text-on-accent` on `--color-accent` | 10.21:1 | 4.5:1 | Pass |
| `--color-text-on-accent` on `--color-accent-hover` | 7.96:1 | 4.5:1 | Pass |
| `--color-text-on-violet` on `--color-capture-single` | 6.31:1 | 4.5:1 | Pass |
| `--color-text-on-violet` on `--color-capture-single-hover` | 4.95:1 | 4.5:1 | Pass (narrow margin) |
| `--color-text-on-danger` on `--color-capture-stop` | 6.91:1 | 4.5:1 | Pass |
| `--color-text-on-danger` on `--color-capture-stop-hover` | 5.23:1 | 4.5:1 | Pass |
| Success text (`--color-accent`) on `--color-tint-ok` over raised | 8.05:1 | 4.5:1 | Pass |
| Failed text (`--color-danger`) on `--color-tint-error-subtle` over raised | 5.19:1 | 4.5:1 | Pass |
| Warning text (`--color-warn`) on `--color-tint-warn` over panel | 7.86:1 | 4.5:1 | Pass |
| Error text (`--color-danger`) on `--color-tint-error` over panel | 5.38:1 | 4.5:1 | Pass |
| Primary text on `--color-tint-warn` over panel | 10.76:1 | 4.5:1 | Pass |
| Canvas tick text (`--color-text-axis`) on `--color-surface-plot` | 6.86:1 | 4.5:1 | Pass |
| Canvas hint (`--color-text-secondary`) on `--color-surface-plot` | 6.40:1 | 4.5:1 | Pass |
| Live tag (`--color-accent`) on `--color-scrim-chip` over plot | 11.56:1 | 4.5:1 | Pass |
| Waiting and stale tag (`--color-warn`) on `--color-scrim-chip` over plot | 11.02:1 | 4.5:1 | Pass |
| Capturing tag (`--color-capture-single`) on `--color-scrim-chip` over plot | 6.37:1 | 4.5:1 | Pass |
| Held tag (`--color-text-secondary`) on `--color-scrim-chip` over plot | 6.77:1 | 4.5:1 | Pass |
| Crosshair readout (`--color-text-readout`) on `--color-scrim-readout` | 16.50:1 | 4.5:1 | Pass |
| Zoom reset label (`--color-text-primary`) on `--color-scrim-chip` | 15.10:1 | 4.5:1 | Pass |

Rules derived from the table:

- Secondary text is never placed on a hovered control fill (4.38:1). Use primary there.
- Warnings are never set in secondary text. Warning and error text on a tint is checked in the table above.
- Ink on every fill is checked for its hover state as well as the rest state (table rows for hover fills).

### 9.4 Non-text contrast (Approved; canvas included)

WCAG 1.4.11 requires 3:1 for graphical objects that are needed to understand the content and for the
visual boundary of a control that is needed to identify it. Canvas graphics are not exempt when they
carry information.

| Object | Pair | Ratio | Need | Result |
| --- | --- | --- | --- | --- |
| Live trace (teal) | `--color-trace-live` on `--color-surface-plot` | 10.93:1 | 3:1 | Pass |
| Max hold (orange) | `--color-trace-max-hold` on plot | 8.97:1 | 3:1 | Pass |
| Min hold (blue) | `--color-trace-min-hold` on plot | 7.46:1 | 3:1 | Pass |
| Held or stale trace (slate) | `--color-trace-stale` on plot | 5.02:1 | 3:1 | Pass |
| Marker (magenta) | `--color-marker` on plot | 7.17:1 | 3:1 | Pass |
| Peak (yellow) | `--color-peak` on plot | 12.70:1 | 3:1 | Pass |
| Active marker and selected peak (white) | `--color-marker-active` on plot | 18.31:1 | 3:1 | Pass |
| Crosshair | `--color-crosshair` on plot | 3.83:1 | 3:1 | Pass |
| Focus ring | `--color-focus-ring` on `--color-surface-app` | 7.77:1 | 3:1 | Pass |
| Focus ring | `--color-focus-ring` on `--color-surface-panel` | 7.12:1 | 3:1 | Pass |
| Focus ring | `--color-focus-ring` on `--color-surface-raised` | 6.50:1 | 3:1 | Pass |
| Focus ring | `--color-focus-ring` on `--color-surface-plot` | 7.46:1 | 3:1 | Pass |
| Status dot (teal) | `--color-accent` on panel | 10.43:1 | 3:1 | Pass |
| Status ring (absent) | `--color-text-secondary` on panel | 6.11:1 | 3:1 | Pass |
| Status cross (failed) | `--color-danger` on panel | 6.30:1 | 3:1 | Pass |
| Violet icon (single mode) | `--color-capture-single` on raised | 5.25:1 | 3:1 | Pass |
| **Text field boundary, before 009** | `#26344a` (`--palette-night-600`) on panel | **1.39:1** | 3:1 | **Fail before 009** (fixed by F15) |
| **Text field boundary, before 009** | `#26344a` on raised | **1.27:1** | 3:1 | **Fail before 009** (fixed by F15) |
| **Text field boundary, implemented (F15)** | `--color-border-input` (`#5b6f8f`) on panel | 3.43:1 | 3:1 | Pass |
| **Text field boundary, implemented (F15)** | `--color-border-input` on raised | 3.13:1 | 3:1 | Pass |
| **Text field boundary, implemented (F15)** | `--color-border-input` on app | 3.74:1 | 3:1 | Pass |
| Grid lines | `--color-grid` on plot | 1.22:1 | Exempt | Decorative (6.5) |
| Strong grid line and frame | `--color-grid-strong` on plot | 1.59:1 | Exempt | Decorative (6.5); the frame is also a border of the plot |
| Button border (today) | `--color-border-default` on panel | 1.39:1 | Exempt | The label identifies the button (9.4 rule 3) |

Rules:

1. Information on the canvas is drawn in a colour that passes 3:1 (traces, markers, peaks, crosshair) and with a shape or word as well (6.4, 6.6, 6.8).
2. Grid lines are decorative. Nothing depends on them.
3. A button's boundary is not required for identification when its label is visible text. Text fields, number fields and selects are required to have a 3:1 boundary (F15).
4. Trace-to-trace luminance is low (1.2 to 1.5:1 between the three traces). They are distinguished by colour and by the words on the tag; line styles are proposed (6.4).

### 9.5 Signals that do not depend on colour (Approved)

| Signal | Shape | Word | Colour |
| --- | --- | --- | --- |
| Connected, acquiring | Solid dot with halo | Connected / Acquiring | Teal |
| Connecting, disconnecting | Pulsing dot | Connecting… / Disconnecting… | Blue |
| Failed | Cross `✕` | Failed | Red |
| Not detected | Empty ring | Not detected | Secondary |
| Mode | Trace icon (continuous repeated sweep) or single sweep icon | Continuous / Single | Teal / violet |
| Running state of capture | Pause or Stop icon | The main label and the name | Red |
| Plot state | The tag | LIVE, Waiting…, No data for N s, CAPTURING, HOLD | Teal, amber, violet, secondary |
| Marker | Diamond and dashed line | M1 to M4 | Magenta (white when active) |
| Peak | Triangle | P1 to Pn | Yellow (white when selected) |
| Warning | ⚠ in text | The message | Amber |
| Uncalibrated | none | Uncalibrated | Amber |
| Trace (live, held, max, min) | Line width and fill differ (live is the thickest and filled) | Tag and legend | Teal, slate, orange, blue |

Data palettes (waterfall): the LUT stops are a data encoding, not UI colour, and stay in `src/plot/colormap.ts`. Their contrast is not a WCAG test (a waterfall is a colour-coded image). The levels are readable only with a legend (6.9, proposed).

### 9.6 Live regions and announcements (Approved policy, Q-17; implemented in 009, B2)

**The rule.** Announce a change only when it needs the user's attention, and announce it once. Assertive interrupts; use it for very few things.

| Event | Politeness | Element | Why |
| --- | --- | --- | --- |
| Device lost while acquiring or connected (DeviceLost) | **Assertive** (`role="alert"`) | Notice banner | An unexpected loss; the data stopped and the user must act. |
| Acquisition stopped by an error (AcquisitionFailed; single capture failed) | **Assertive** | Notice banner | Unexpected; the measurement stopped. |
| Internal failure (Internal) | **Assertive** | Notice banner | The backend recovered from a crash. |
| Connect failed (ConnectFailed, or the command error of a connect) | Polite (`role="status"`) | Notice banner | The user's own action failed; they are already on the screen where the result shows. |
| Other command failed (save display settings, restart, forget undo, scan error) | Polite | Command banner | The user's own action. |
| Test connection result (ok, failed, busy) | Polite | Test result box (`role="status"`) | Their own action. The box is visible at the press. |
| Save or form error in the dialog or the connect form | Polite | Inline error | Their own action; the error stays visible until corrected. |
| Single capture complete | Polite | Visually hidden capture live region | Completion of a long action the user started. |
| Single capture cancelled | Polite | As above | |
| Source connected or disconnected (once per attempt, the outcome) | Polite. **Proposed** (not announced today). | Capture live region or the notice region | The outcome of the user's action; the name and status show it visually. |
| Forgot a source; Undo | Polite (Implemented as `role="status"`) | Undo toast | |
| Frames, ticks, liveness changes, stale transitions | **Never** | | Continuous data; a stream of announcements is unusable. |
| Field validation while typing | Never (read through `aria-describedby` on focus) | | |

Implementation rules:

1. **The live region container is always in the DOM** (`div` with `aria-live`), and the banner is inserted into it. The dialog's notes, warnings and errors share one such container. An element inserted together with its live attribute is announced unreliably.
2. One cause, one announcement. The notice and the command error for the same cause are not both announced (Implemented in `NoticeBanner`).
3. A visible state is never announced only through a live region. The live region is an addition.
4. Visually hidden text is for announcements only. Information that the user must see stays visible (the banner or the tag), so it is available to every user.
5. `role="alert"` is not used on any element that is not in the table above. Draft 1 gave every banner `role="alert"`.

### 9.7 Visible versus available (Approved)

- **Visible and available:** the tag, banner, status word, row line 2, toolbar state. Every state has one.
- **Available only:** the visually hidden capture live region, the aria names and descriptions, the canvas's accessible name. Nothing is hidden only from sighted users.
- **Visible only:** decorative glyphs and grid lines (`aria-hidden`, decorative). Nothing that carries information is visible only.

### 9.8 Focus (Approved)

- Visible focus on every focusable element with the ring from 2.7. Never `outline: none` without a replacement.
- Focus order follows the visual order: toolbar (brand, not focusable), notice stack (recovery, dismiss), side panel (sections in order; Measurement: source button, Center, Span, FFT size, Window, Averaging, the hold row, then the capture control; Source settings after it), status bar (not focusable).
- A popover receives focus on open and returns it on close (Escape). A popover that closes because focus left it does not move focus back (5.1).
- Focus is never lost. A removed element hands focus to the nearest remaining item (for example Forget moves focus to Undo; when Undo expires, focus goes to the first row).
- The plot is not focusable today. Keyboard use of the plot is Deferred (6.10).

### 9.9 Target size (Approved requirement; values in F2, F13, F14, implemented in 009)

WCAG 2.2 2.5.8 (AA) requires **24 by 24 CSS px** for pointer targets, with one exception: a target smaller than 24px is allowed when a 24px circle centred on it does not overlap any other target or its circle. The design uses the requirement, not the exception. The exception is not used.

| Target | Measured today (CSS px) | Requirement | Result | Fix |
| --- | --- | --- | --- | --- |
| Source button (side panel since 040) | 305 x 30 (1440 and 1024, measured in 040) | 24 x 24 | Pass | |
| Capture main (side panel since 040, full width) | 279 x 30 (1440 and 1024, measured in 040; 128 x 30 before) | 24 x 24 | Pass | |
| Capture chevron | 26 x 30 | 24 x 24 | Pass | |
| Center field (side panel since 038) | 140 x 28 in the panel (1440 and 1024, measured in WebKitGTK) | 24 x 24 | Pass (height 28, below the 30px control height) | F1 |
| Span select (side panel since 038) | 140 x 28 in the panel (1440 and 1024, measured in WebKitGTK) | 24 x 24 | Pass (height 28, below the 30px control height) | F1 |
| Side panel select (FFT size) | 140 x 28 (1440 and 1024, measured in WebKitGTK) | 24 x 24 | Pass (height 28, below the 30px control height) | F1 |
| `button.small` (Peak search) | 81.5 x 22.8 | 24 x 24 | **Fail** | F2 |
| Marker × (table) | 23 x 20 | 24 x 24 | **Fail** | F2 |
| Notice dismiss × | 22.5 x 20 | 24 x 24 | **Fail** | F2 |
| Popover row action (Edit, Forget) | 24 x 24 (measured in the 44px row; centred in the badge column) | 24 x 24 | Pass (ruling 009 T9) | F2 |
| Zoom reset | 124.8 x 21.4 | 24 x 24 | **Fail** | F13 |
| Checkbox label (Waterfall) | 79.1 x 19 | 24 x 24 | **Fail** | F14 |
| Readout table row | 305 x 27 | 24 x 24 (as a pointer target) | Pass | |
| Popover row, two lines | 44 (`--row-height`) | 24 x 24 | Pass | |
| Popover row, one line | 30 min | 24 x 24 | Pass | |
| Undo button in toast | 26 min | 24 x 24 | Pass | |

Rules:

- A target is at least 24 by 24 CSS px. Padding counts; the visible border need not.
- Spacing is not used to reach 24. Where a target is smaller, it is made larger.

### 9.10 Unavailable and read-only controls (Approved rules; values implemented in 009, F9)

- A control that cannot be used now is **unavailable** (`--opacity-unavailable`). It says why in a description or a visible place (5.4). If it can still receive focus (aria-disabled), it keeps its tooltip and description. If it is native-disabled, its reason is visible elsewhere on the same screen.
- Contrast of the unavailable label at each candidate opacity (computed; WCAG exempts unavailable controls, so these are design targets):

| Opacity | Primary label on control fill | Primary label on panel | Ink on the teal primary button, blended with panel |
| --- | --- | --- | --- |
| 0.45 (today's buttons) | 3.48:1 | 3.75:1 | 3.08:1 |
| 0.55 (today's locked chevron) | 4.45:1 | 4.95:1 | 3.97:1 |
| **0.6 (implemented, F9)** | **5.00:1** | **5.64:1** | **4.48:1** |

- **Read-only, in use** (`--opacity-read-only`, 0.75): the value stays readable (6.93:1 on the control fill).
- Opacity is the only way a control state is dimmed. A new state picks one of the three in 2.15.
- Native-disabled controls (accepted deviation, T6): Peak search, Next peak and + Marker. They leave the tab order, so their reason must be visible on the same screen (the rule above). QA confirms it (12.1, A10).

### 9.11 Display scaling and text enlargement (Approved test matrix; see 3.9)

The app is a desktop window. Layout is tested at the CSS widths in 3.9. Desktop scale factors do not change the CSS layout; text enlargement does. Zoom by keyboard is unsupported (Q-5): it is not a requirement in 009, and QA records whether the webview responds to Ctrl+= and Ctrl+- (T13). Font sizes are tokens, so a future text-scale setting changes one place. No text is set below 11px.

### 9.12 Names and roles (Approved; corrections marked)

| Element | Role and name | Status |
| --- | --- | --- |
| Toolbar | `<header>` with `aria-label="Main toolbar"`. Not `role="toolbar"`: no roving focus is implemented, and a toolbar role without arrow-key navigation is misleading. | Implemented in 009 (B7) |
| Notice stack | Live regions per 9.6 | Implemented in 009 (B2) |
| Source button | Button, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` the popover, name `Source: <name>, <state>` or `Source: Choose a source` (the latter retired in 015: a source is always selected). `<state>` is the status word the row shows (Connected, Acquiring, Connecting…, Failed, Not detected); Disconnected when the row shows none (fixed in 013, F4: a failed source is `Failed`, not `Disconnected`) | Implemented in 009 (B1): dialog, not menu |
| Source popover | `role="dialog"`, `aria-label="Sources"`, groups with visible labels, lists | Implemented in 009 (B1) |
| Source rows | Button in a list item; `aria-current="true"` on the active row; the name includes the status word | Implemented in 009 (B1) |
| Row actions | Ordinary buttons "Edit <name>", "Forget <name>" | Implemented in 009 (B1); was `role="menuitem"` |
| Capture group | `role="group"`, label "Capture" | Implemented |
| Capture main | Button; name is the action; `aria-disabled` when busy | Implemented |
| Capture chevron | Button; `aria-haspopup="menu"`, `aria-expanded`, name "Capture mode: <mode>" | Implemented |
| Capture mode menu | `role="menu"`, items `menuitemradio` | Implemented |
| Side panel | `<aside aria-label="Analysis controls">` | Implemented |
| Spectrum | `<section aria-label="Spectrum display">`; the canvas is `role="img"` with an accessible name that states the span and unit | Implemented |
| Waterfall | `role="img"`, name "Waterfall" | Implemented. Not changed. |
| Status bar | `<footer>` (contentinfo); not a live region | Implemented |
| Plot tag | Text; not a live region | Implemented |
| Dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Implemented |
| Icon-only buttons | `aria-label` naming the object | Implemented; keep |
| Status glyph | `aria-hidden` | Implemented |
| Disclosure (side panel sections) | Native `details` and `summary` | Implemented |

### 9.13 Motion (Approved)

- Reduced motion is honoured for every animation (2.13). The pulse runs at 1 Hz; nothing flashes faster than 3 Hz.
- The pulse's low point is 25% opacity, below 3:1 for that moment. The state is also in the text ("Connecting…"), so the pulse is not the only signal.

### 9.14 Forced colours and high-contrast themes (Open; QA)

Not verified. The focus ring is an outline (survives forced colours). Status glyphs use borders and text (survive). Tints and the traces use colour (may not survive). QA checks the app with the GTK high-contrast theme before a release; a finding there becomes a fix to this section.

### 9.15 Keyboard-only use (Approved)

- Every action in 5.10 works without a pointer, except the plot interactions in 6.10 that are pointer only (Deferred). Those actions have a control elsewhere: the marker table's + Marker and Peak search, the Center field, the Span select.
- Hover-only reveals (row actions) are also reachable by focus: the actions are focusable when hidden (Implemented).
- Shortcuts never replace a visible control. They are additions (Ctrl+K, F2, Delete).

---

## 10. Governance: how to add or change a token or a component

### 10.1 Token (Approved)

1. Propose the change in the work item (PM), with the screen it affects.
2. Add or change the **primitive** first, then the **semantic** token that points at it. Components are not changed to use a new primitive directly.
3. Update the token file **and Appendix A** in the same change. The register (12.1) gets a row for a new token.
4. Check contrast for every text or icon pair that uses the token (9.3, 9.4). A pair under 4.5:1 for text, or 3:1 for non-text that carries information, is not allowed.
5. Run the token tests (2.18) and the visual check (10.4).
6. A change to a **capture or status semantic** (2.5, 2.6) needs an ADR in `docs/adr/` and the designer's approval.
7. Renaming a token keeps the old name as an alias for one release, then removes it.

### 10.2 Component (Approved)

1. A component is added to `src/ui/` only when a second screen needs it, or when a fix in `design.md` names it. Feature code keeps its own markup until then. `SourceButton` stays feature markup (accepted, T11; D1).
2. A `src/ui/` component is presentational: props in, callbacks out. It imports no IPC, no store, no session, no bindings and no device or driver type.
3. Each component is listed in section 4 with purpose, anatomy, variants, sizes, states, keyboard, ARIA and do and don't. A change of behaviour updates the entry in the same change.
4. Each component has unit tests covering render, variants, states, and keyboard or ARIA where relevant (`docs/guidelines.md`).
5. Feature code uses the component. Duplicated markup or CSS for the same element is removed in the same change.
6. A visual change to a component is shown as before and after in the work item.
7. Every component has stories (`<Name>.stories.tsx` in its folder) for each state it documents (ADR 0016). `src/ui/stories.test.tsx` fails the check when a folder has no stories file or a story throws.

### 10.3 Guards (Approved; written in 009)

- A lint or test rule keeps `src/ui/` free of imports from IPC, state, bindings and device modules (ADR, staff engineer).
- The token tests in 2.18 (variables defined, no literals, contrast, canvas map).
- A grep test forbids `toFixed` and `toLocaleString` in `src/ui/` (formatting goes through `src/format/`, 7.5).
- The contract tests (`src/ui/SplitButton/SplitButton.geometry.test.ts`, `src/components/source/source.css.test.ts`) read geometry by token name (12.3, E4).
- `src/ui/stories.test.tsx`: every component folder has a stories file, every story renders, runs its play function and has no axe violation (work 010), and no app file imports Storybook (ADR 0016).

### 10.4 Visual check (Approved)

Every change that touches a screen comes with before and after screenshots of:

- The source popover: rows, actions, the Undo toast, the fixed items, the connect form.
- The capture mode menu.
- The Add / Edit dialog: idle, test running, test failed, locked.
- Capture states: idle teal, idle violet, acquiring red, unavailable chevron, unavailable main, focus ring.
- The side panel sections.
- Banners: warning, error, command.
- The status bar: live, no frame, no source, connecting.
- The window at 1440 and at 1024 with a 60-character name and the device id `SA430 08FF41E50F8B3A34`.

The prototype (`.claude/team/work/009-design-system/prototype/index.html`) is the design reference for these states. It is illustrative (0.1, rule 3).

### 10.5 Documents (Approved)

- This file is the design source. `docs/architecture.md` describes the `src/ui/` boundary and the token approach (ADR 0015). `docs/guidelines.md` links here for UI work. `docs/README.md` links here.
- A decision that changes a rule here is recorded as an ADR when it is technical, and noted in section 13 (changelog) and in the register (12.1).

---

## 11. Checklists

Before a UI change is handed over:

- [ ] Colour from a semantic token; no literal colour, radius, shadow or z-index in CSS (2.17).
- [ ] Text sizes from the scale; nothing below 11px.
- [ ] Spacing from the scale, or a listed geometry token.
- [ ] Every control has a visible focus ring from the focus tokens; no `outline: none` without a replacement.
- [ ] Every state (default, hover, focus-visible, active, unavailable, loading, error) exists or is intentionally absent, and the absence is in 2.6 or 5.8.
- [ ] Capture colour still means mode; amber is not used for running or pause.
- [ ] Every amplitude shows its unit; uncalibrated data says `Uncalibrated`.
- [ ] Long text: the source name, device id, port and error message checked at 1024px.
- [ ] The popover or menu keyboard path works: Escape returns focus; Tab leaves a popover without a trap (5.1).
- [ ] Announcements follow 9.6: one per cause, polite unless it is an unexpected failure; the container is always in the DOM.
- [ ] Every target is at least 24 by 24 CSS px (9.9).
- [ ] Every unavailable control gives its reason in a description or a visible place (5.4).
- [ ] Canvas: no smoothing; no auto-scale; held and stale data carry their tag; readouts show "—" outside the data (6.12).
- [ ] Measurement values go through `src/format/` (7.5).
- [ ] Reduced motion honoured.
- [ ] Before and after screenshots attached (10.4).

---

## 12. Decision register, open questions and engineering items

### 12.1 Decision register

Status values are defined in 0.3. "Where" gives the section of this file or the work item.

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| T1 | Three token layers and one token file | Implemented in 009 (E1) | 2.1, 2.18 |
| T2 | Alpha colours are explicit `rgba()` values; no `color-mix()` | Approved | 2.4 |
| T3 | Shadows and scrims are separate tokens; no combined "scrim 0.5 / 0.6" | Approved | 2.4, 2.12 |
| T4 | Focus ring tokens: 2px, 1px offset, 2px group offset, own colour token | Approved (values); F4 implemented in 009 | 2.7 |
| T5 | Canvas reads tokens at runtime; no second palette (data LUT stays in TypeScript) | Implemented in 009 (E3); scope decided (Q-16) | 2.18, Appendix B |
| T6 | Text field, number field and select boundary 3:1 (`--color-border-input`) | Implemented in 009 (F15) | 4.4, 9.4, F15 |
| T7 | Unavailable opacity 0.6; locked chevron joins it; read-only 0.75 | Implemented in 009 (F9; Q-3 accepted by the PM) | 2.15, 9.10, F9 |
| T8 | Canvas axis and readout text keep their values as tokens; merging with the DOM secondary text is a later decision | Approved for 009 (values kept); merge not decided (Proposed) | 2.16 |
| C1 | Capture colour semantics (teal, violet, red; amber never for running) | Implemented; Approved (work 006) | 2.5 |
| C2 | Status shapes and words; idle has no word; the toolbar shows the glyph only | Approved (clarified); toolbar shows the glyph only (Q-6: no change) | 2.6 |
| G1 | Authority order and the ADR precedence question | Approved; Q-15 decided: the ADR wins for technical behaviour, this file for presentation | 0.1 |
| G2 | Decision statuses and requirement levels | Approved | 0.2, 0.3 |
| W1 | Width ranges A, B, C from the CSS (1180 inclusive in C) | Approved | 3.2 |
| W2 | Status bar: whole-item removal in the stated order; no cut | Implemented in 009 (F0; order Q-4 accepted) | 3.4 |
| W3 | Status bar: `Uncalibrated` visible at every supported width | Approved; implemented in 009 (F0, regression tests at 1024 px) | 3.4, F0 |
| W4 | No overflow menu in the toolbar | Approved | 3.3 |
| W5 | Side panel fixed at 330px; peak table capped at eight rows | 330px Implemented; cap Deferred (B5, backlog) | 3.6 |
| W6 | Notice stack capped at 96px and scrolls | Deferred (B6, Q-20; backlog) | 3.5 |
| W7 | Waterfall hidden below 240px plot height (user setting kept) | Deferred (Q-21; backlog) | 3.7 |
| W8 | Display scale tested as layout-identical; text enlargement tested at CSS widths | Approved (matrix); zoom unsupported (Q-5) | 3.9 |
| I1 | Source selector is a popover with list semantics, not a menu | Implemented in 009 (B1) | 4.11, 5.1 |
| I2 | Capture mode selector is a command menu (`role="menu"`) | Implemented; Approved | 4.11 |
| I3 | Escape returns focus to the trigger; Tab leaves a popover without a trap | Approved; implemented in 009 (B1) | 5.1 |
| I4 | Type-ahead in the source popover is removed | Implemented in 009 (B1; Q-18 accepted) | 5.1 |
| I5 | Popover row actions are ordinary buttons (not menu items) | Implemented in 009 (B1) | 4.11 |
| I6 | Source lifecycle states S0 to S12 and the ownership table | Approved; start-up states S0 and S12 Deferred (B3) | 5.2 |
| I7 | Start-up "Loading…" and "Status unavailable" states | Deferred (B3, backlog) | 5.2, 8.2 |
| I8 | Switching source while acquiring | Deferred (Q-22: option B in the backlog; option A stays until then) | 5.2.6 |
| I9 | Connect has no cancel; Deferred | Deferred (Q-12, backlog) | 5.2.5 |
| I10 | Readout selection: single selection; id cell is the keyboard target | Single selection Approved; keyboard target Deferred (B4, backlog) | 5.3 |
| I11 | Peak click also places the active marker | Implemented (kept, Q-7); split Deferred (backlog) | 5.3 |
| I12 | Tooltips: native `title` for supplementary text; reasons in a description or a visible place | Approved (rules) | 5.4 |
| I13 | Custom tooltip | Deferred | 5.4, 4.17 |
| I14 | Segmented control, tabs, context menu, confirmation dialog | Deferred (rules written for when used) | 5.5 |
| I15 | Undoable destructive actions use an undo toast, not a confirmation (Forget) | Implemented; Approved | 5.2.8, 5.5 |
| I16 | Progress: spinners with text; no made-up progress | Approved | 5.5 |
| I17 | Shortcut hints in titles and the user guide only | Approved | 5.5, 5.10 |
| P1 | Click, Shift+click, drag, wheel, Ctrl+wheel, double-click (pointer interactions) | Implemented; Approved | 6.10 |
| P2 | Drag to select a range | Rejected for this release | 6.10 |
| P3 | Keyboard marker movement and keyboard zoom | Deferred (Q-8, backlog) | 6.10 |
| P4 | Touch input | Deferred (Q-14) | 6.10 |
| P5 | No smoothing; peak-detector display; per-bin vertices when zoomed in | Implemented; Approved | 6.1 |
| P6 | Amplitude axis never auto-scales | Implemented; Approved | 6.1 |
| P7 | Marker level by linear interpolation between bins; peaks are interpolated estimates | Implemented (`docs/dsp.md`); Approved | 6.6 |
| P8 | Hold traces keep their colours when the live trace is held | Implemented; Approved | 6.3 |
| P9 | Non-colour trace differentiation by line style (dashed and dotted holds) | Deferred (Q-9, backlog) | 6.4 |
| P10 | Waterfall colour strip (legend) | Deferred (Q-10, backlog) | 6.9 |
| P11 | One frequency unit per axis | Deferred (backlog) | 6.5 |
| P12 | Readout tables show "Last data hh:mm:ss" when not live | Deferred (backlog; prioritised: the values look current while the plot says No data) | 6.8 |
| P13 | Over-range indicator at the plot edge | Deferred (backlog) | 6.12 |
| P14 | Stale threshold for slow sweeps | Deferred (Q-11; backlog bug, design in `plan.md` section 9) | 7.6 |
| P15 | Connecting and disconnecting copy on the plot and status bar | Deferred (B8, backlog; bug) | 8.2, 6.8 |
| R1 | Latest-wins frames; one outstanding request; no frame in React state | Implemented (ADR 0003); Approved | 7.1, 7.3 |
| R2 | Render budgets 250 ms, 500 ms, 3 s; canvases per animation frame | Implemented; Approved | 7.2 |
| R3 | Stable axes and fixed insets; no layout shift from data, except the peak table (B5) | Approved | 7.4 |
| R4 | Formatting through `src/format/`; decimals per resolution | Implemented; Approved | 7.5 |
| R5 | No animation on data | Approved | 7.7 |
| A1 | WCAG 2.2 AA | Approved | 9.1 |
| A2 | Large text: 24px regular, 18.67px bold; corrected | Approved (correction) | 9.2 |
| A3 | Contrast tables 9.3 and 9.4, computed from tokens | Approved | 9.3, 9.4 |
| A4 | Target size 24 by 24 CSS px; spacing exception not used | Approved (requirement); F2, F13, F14 implemented in 009 | 9.9 |
| A5 | Live-region policy: assertive only for unexpected failures; polite otherwise; container always in DOM | Approved (policy); implemented in 009 (B2) | 9.6 |
| A6 | `role="toolbar"` removed from the toolbar | Implemented in 009 (B7) | 9.12 |
| A7 | Forced colours and high-contrast themes | Open (QA) | 9.14 |
| A8 | Focus ring composite (`:has()`) support in WebKitGTK | Open (QA; re-measure) | 2.7 |
| S1 | Test matrix: 100%, 1180, 1440 windows; display scale; zoom at 125%, 150%, 200% | Approved (matrix) | 3.9 |
| S2 | Zoom beyond 125% of the minimum window: toolbar reflow | Deferred (Q-5: zoom unsupported; QA reports the shortcuts in T13) | 3.9 |
| GOV1 | Token file and Appendix A are the single source; tests enforce it | Approved; guards written in 009 (2.18, 10.3) | 2.18, 10.3 |
| GOV2 | Designer approves changes to capture and status semantics | Approved | 10.1 |
| F0 | Status bar: whole-item removal, `Uncalibrated` always visible (3.4) | Implemented in 009 (PM accepted, decisions.md) | 3.4, F0 |
| F1 to F15 | Small fixes of `design.md` section 2 (F1 to F11, F13 to F15; F12 has no visual change) | Implemented in 009 (PM accepted, decisions.md) | design.md 2 |
| F16 | Checkbox accent `--color-accent` (teal), not the WebKit default blue | Accepted (PM, T6); implemented in 009 | 4.6 |
| F17 | Center and Span value text in `--color-text-primary` | Accepted (PM, T7); implemented in 009 | 4.4 |
| 013-F2 | The capture control is not sticky: it scrolls with the side panel (decided by the human; Source settings can scroll it out of view) | Decided (human, 013); no change | 3.6, 4.3 |
| 013-F1, 013-F3 to 013-F5 | Popups open above their trigger when there is no room below (F1); status bar 24px and workspace 583px (F3); accessible name uses the row's status word (F4); FFT size and Window disabled with the reason while no source is connected (F5, issue 21) | Implemented in 013 | 3.1, 3.6, 3.7, 4.3, 4.11, 9.12 |
| D1 | Dialog: Save is busy (not native `disabled`); notes and errors in one polite region; warnings `role="status"`; stacked label secondary in the dialog and the connect form (T11); ParamForm `framed` | Accepted (PM, T10); implemented in 009 (T11) | 4.12, 9.6, 4.4 |
| D2 | Known off-scale token values (`--row-gap`, `--capture-main-gap`, `--capture-main-padding-x`, `--field-padding-frequency`, `--plot-tag-padding-x`, `--source-test-*`) | Approved as known exceptions; snap is a later pass | 2.9 |
| U1 | Busy is not unavailable: a busy button, the busy Save and the busy capture main keep full strength; a control is dimmed only when its action cannot run | Accepted (PM, T11); implemented in 009 | 2.15, 4.1, 4.3, 4.12 |
| I19 | Popover list keys stop at the first and last row (no wrap); leaving the popover by Tab closes it | Implemented in 009 (B1; T5 accepted) | 4.11, 5.1 |
| A10 | Accepted deviation: Peak search, Next peak and + Marker use native `disabled` (T6); 9.10 needs their reason visible on the same screen | Implemented in 009 (T6 accepted); QA to confirm the reason is visible | 9.10 |
| M14 | Measurement rows a source does not use are hidden, not disabled; the order is fixed (source button, Center, Span, source rows, Averaging, hold row, capture) | Approved and implemented (014) | 3.6 |
| M15 | Frequency step and Reference level move from Source settings to Measurement with the same commit rules | Approved and implemented (014) | 3.6, 5.8 |
| M16 | Unit announced for NumberField (`aria-describedby`); device values show an em dash with no source | Approved and implemented (014) | 4.4, 9.6 |
| M17 | A source is always selected; the Signal simulator is the launch fallback | Approved (015, #46) | 5.2.10 |
| M18 | "Loading…" and "Status unavailable" at start-up (B3 pulled into 015) | Proposed (015, Q-30) | 5.2, 8.2 |
| M19 | Selected, not connected state S13, its copy and the disconnected hint | Proposed (015) | 5.2.2, 5.8, 8.2 |
| M20 | Launch failure of a detected device keeps the device selected, no simulator fallback | Proposed (015, Q-27) | 5.2.10 |
| M21 | Forgetting a selected source that is not connected selects the Signal simulator | Proposed (015) | 5.2.8, 5.2.10 |
| M22 | A device replaces any idle simulator (auto-started or picked by the user); never while acquiring. ADR 0017 amends ADR 0014 | Approved (015, #46; Q-28 decided at the design gate) | 5.2.10 |
| M23 | The Signal simulator is always in the popover's fixed block, never under Your sources | Proposed (015) | 4.11, 5.2.10 |

### 12.2 Questions and decisions (product decisions)

The designer's recommendation is kept for the record. The last column is the PM's decision for work 009 (`decisions.md`, 2026-11-16), as delegated by the human. Items marked Backlog are tracked in GitHub issues; some were closed there as not planned.

| ID | Question | Designer's recommendation | Who decides | Decision (PM, work 009) |
| --- | --- | --- | --- | --- |
| Q-1 | Status bar at narrow widths (F0): accept whole-item removal with the order in 3.4? Is it a bug for PM (calibration state hidden from 1024 to 1257px today)? | Accept. Track as a bug, not as part of the token work. | Human, PM | Accepted; fixed in 009 (F0) |
| Q-2 | Copy: "press Play" to "press Continuous" / "press Single" (C1)? | Yes. It matches the button. | Human | Accepted; implemented in 009 (C1) |
| Q-3 | Unavailable opacity: 0.6 (proposed) or another value? | 0.6. It is the lowest value, in steps of 0.05, where the primary label reaches 4.5:1 on the control fill. | Human | Accepted: 0.6; implemented in 009 (F9) |
| Q-4 | Status bar removal order (3.4): Frame, Rate, Noise floor, FFT, Avg, RBW? | Yes. Frame and Rate are the least needed while the plot tag shows data age. | Human | Accepted; implemented in 009 (F0) |
| Q-5 | Is in-app text enlargement (zoom) a requirement? Before 040 the toolbar did not overlap down to 465 CSS px (it clipped at about 427 CSS px, 3.2 and 3.9). Since 040 the toolbar is the brand only, and the side panel (fixed 330px, its source button and capture control) is the part to re-measure at each zoom level; that is not done yet. The status bar drops items at 683 and 512 CSS px (3.9). Webview zoom keys (Ctrl+=, Ctrl+Shift+=, Ctrl+0) do nothing in this build (O7, verified in the real app). | Not in work 009. Record zoom as unsupported until decided. | Human | Unsupported. Not a requirement in 009. Zoom by keyboard does nothing in this build (O7). Backlog: zoom support |
| Q-6 | Source button (side panel since 040): show the status word (for example "Connecting…") beside the name, or keep the glyph only? | Keep the glyph only (the name is scarce space). The capture control shows acquisition. | Human | Glyph only (no change) |
| Q-7 | Peak click: keep "select and place marker", or split into "select" and "Place marker" (I11)? | Split. It makes the marker move explicit. | Human | Kept as it is in 009; the split is in the backlog |
| Q-8 | Keyboard use of the plot (marker movement, zoom keys, 6.10): in a later work item? | Yes, later. Not in 009. | Human, PM | Backlog (later work item) |
| Q-9 | Non-colour trace differentiation: dashed max hold and dotted min hold (6.4)? It changes the canvas. | Yes, as a separate work item. | Human | Backlog (separate work item) |
| Q-10 | Waterfall colour strip (6.9)? | Yes, as a separate work item, small. | Human | Backlog (separate work item) |
| Q-11 | Stale threshold (7.6): is 2 seconds right for slow sweeps? If not, the backend must report the sweep time, or the threshold is per source. | Bug candidate. The staff engineer says whether the frame can carry the sweep time. | Human, staff engineer | Backlog bug candidate; design in `plan.md` section 9 (`sweepIntervalMs`) |
| Q-12 | Connect cancel (5.2.5): add a cancel while connecting? | Deferred. | Human | Backlog (Deferred) |
| Q-13 | Devices without a serial number, or two devices reporting the same id (5.2.3): what should the app do? | Staff engineer and driver owner to answer; the UI shows the backend's identity and blocks a duplicate. | Staff engineer, human | Answered by the staff engineer: ADR 0010, decision 1. No change in 009 (5.2.3) |
| Q-14 | Touch input: in scope for the desktop app? | No. Deferred. | Human | Deferred (no touch input) |
| Q-15 | Authority: when an accepted ADR and this file disagree on a technical behaviour, does the ADR win (as in 0.1)? | Yes for technical behaviour; this file wins for presentation. | Human | Decided: the ADR wins for technical behaviour; this file wins for presentation (0.1) |
| Q-16 | Scope: review section 6 asks that the canvas read tokens, but the story excludes "plot canvas rendering internals". Is the token read (no visual change) in work 009? | Yes, as a token read only. Rendering stays out of scope. | Human, PM | Token read in 009 (E3); rendering internals out of scope |
| Q-17 | Live region policy (9.6): are the assertive and polite assignments right, in particular connect failure as polite? | Yes, as written. | Human | As written (9.6); implemented in 009 (B2) |
| Q-18 | Type-ahead in the source popover (5.1): remove, or keep for keyboard users who rely on it today? | Remove, with the Up and Down row navigation, because a list of buttons does not need it. Keyboard users keep Tab. | Human | Removed in 009 (B1); Up and Down, Tab kept |
| Q-19 | Peak detection off: keep hiding the table, or show the note (8.2)? | Keep hidden. The note is optional. | Human | Keep hidden |
| Q-20 | Notice stack cap (B6, 96px): accept? | Yes. | Human | Backlog (B6) |
| Q-21 | Waterfall hidden automatically below 240px total plot height (W7): accept? | Yes. | Human | Backlog (W7) |
| Q-22 | Switching source while acquiring (5.2.6): A keep and state the consequence, B other rows unavailable while acquiring with the reason shown, or C an inline confirmation? | B. The user pauses first, and the trace is not lost by accident. | Human | Backlog as option B, with B3 and B8. Option A stays until then |
| Q-23 | Capture chevron while a command runs (2.5): dimmed as built, or full strength like the busy Save (U1)? | Full strength with `aria-disabled` and the reason in its description, so it matches U1. It still refuses the click. | Human, PM | Open. Built dimmed in 009; not changed in 009 |
| Q-24 | Label of the device step: "Freq. step" (approved order) or "Frequency step" (the driver's label, the story's name)? | "Frequency step". The full word fits; the UI does not rename device labels. | Human, PM | Open (014) |
| Q-25 | Two "Reference level" labels (Measurement device level, Display plot level): keep both, or rename the device row to "Input level" (a driver label change)? | Keep both (minimal copy). They differ by group, value (dBm) and description; 8.5 defines both. | Human | Open (014) |
| Q-26 | A connected SA430 has no rows in Source settings: keep the section with "This source has no additional settings." or hide the section? | Keep it. The section order stays stable and the hint is accurate. | Human | Open (014) |
| Q-27 | A detected device fails to connect at launch: stay on it (Failed, banner, Reconnect) or fall back to the simulator? | Stay on it. The fallback is for "no device found" (#46). | Human | Open (015) |
| Q-28 | What is "auto-started"? Is a simulator the user picked ever replaced by a device? | A user's pick is never replaced. | Human | Decided (design gate): any idle simulator is replaced; the designer's recommendation is overridden |
| Q-29 | Hold row (Max hold, Min hold, Reset) for a trace source: shown? | Shown for both kinds (the trace pipeline applies holds to trace sources). The approved per-source lists omit it. | Human, PM | Open (014; assumption) |
| Q-30 | Pull B3 (start-up "Loading…" and "Status unavailable") into 015? | Yes. Without it the button shows "Choose a source" at start-up. | PM, human | Open (015) |
| Q-31 | Selected but not connected (S13): add a visible word ("Disconnected") to the source button's name? | No. The name and the idle dot; the plot tag and the status bar say "No source connected". | Human | Open (015) |

### 12.3 Engineering items (staff engineer; design.md section 6)

Status after 009: E1 to E7 are implemented. E1 is the token file and its tests, E2 the two own tokens, E3 the canvas token read, E4 the contract tests that read tokens, E5 the single heading, popover and dot styles, E6 the status bar with its 1024 px tests, E7 the live regions and popover semantics.

- **E1.** The token file (`src/styles/tokens.css`), its aliases, and the token tests (2.18).
- **E2.** `--color-trace-min-hold` is its own token (done in the draft; implement it). `--color-focus-ring` is its own token.
- **E3.** `src/plot/theme.ts` reads its colours from the token file at runtime (Appendix B). Data LUT stays in `colormap.ts`. Geometry (`PLOT_INSETS`) stays in `theme.ts`.
- **E4.** The contract tests (`src/ui/SplitButton/SplitButton.geometry.test.ts`, formerly `capture.css.test.ts`, and `src/components/source/source.css.test.ts`) read geometry by token name when the tokens land, in the same change.
- **E5.** One heading style and one popover surface (`.source-heading` and `.mode-heading`; `.source-popover` and `.mode-popover`); one `StatusDot`; the duplicate `.waterfall-axis` rule.
- **E6.** The status bar mechanism (F0) and its regression test at 1024px.
- **E7.** The live region container (9.6) and the popover semantics (B1). These change markup in `SourceMenu.tsx`, `CaptureControl.tsx`, `NoticeBanner.tsx`, `SourceDialog.tsx`, `SourceForm.tsx`.

### 12.4 Assumptions

- The screen set is complete for this design. No new screens are in scope.
- Native `select` and `checkbox` stay (no custom listbox). The native checkbox's boundary in WebKitGTK is not verified (A8, QA).
- The font stacks are unchanged. Fonts are not bundled. Measurements used fallback fonts (see the header).
- Canvas chrome (axes, grid, readouts) uses the same data and surface tokens as the DOM. The canvas renderer's internals are out of scope except for the token read (Q-16).
- The simulator paces blocks at 30 per second (`BLOCK_RATE_HZ`). Frame rate otherwise follows the source.

---

## 13. Changelog

### 13.0b Draft 5 (2026-11-19): work 014 (#45) and work 015 (#46)

- **Status.** Version 1.0-draft.5 (was 1.0-draft.4). Design delta only; no prototype (minor layout change in 014; no new screen in 015). The work folders hold `design.md`.
- **014.** Frequency step and Reference level move from Source settings to Measurement, after Span. Rows a source does not use are hidden (3.6, 12.1 M14 and M15). Unit announced for NumberField (4.4, M16). Glossary entries for the two "Reference level" meanings (8.5).
- **015.** A source is always selected; the Signal simulator is the launch fallback; a device replaces any idle simulator (5.2.10, M17, M22). New state S13 (selected, not connected), its copy (5.2.2, 5.8, 8.2, M19). "Choose a source" is retired. B3 ("Loading…", "Status unavailable") is pulled into 015 as Proposed (M18, Q-30).
- **ADR amendment.** ADR 0014 said "never replace a source"; M22 changes that for an idle simulator. Done in ADR 0017.
- **Open for the human.** Q-24 to Q-31 (12.2).

### 13.0 Draft 4 (2026-11-16): reconciliation with the shipped work 009

- **Status.** Implemented in 009; final QA pending (T13). Version 1.0-draft.4 (was 1.0-draft.3). Checked against `src/` on 2026-11-16: `src/styles/tokens.test.ts` passes (12 tests; Appendix A equals `tokens.css`).
- **Priorities.** P11, P12 and P13 are Deferred (backlog in GitHub issues). P12 is prioritised (6.8, 12.1, 14).
- **Corrected to the shipped code.** Stacked field labels are secondary in the dialog and in the connect form (4.4, D1). A busy control is not unavailable: busy Save, busy buttons and the busy capture main keep full strength (rule U1; 2.15, 4.1, 4.3, 4.12). The capture chevron is still dimmed while a command runs; that is open as Q-23. The native-disabled peak controls are recorded as an accepted deviation (A10).
- **Keyboard.** Popover Up and Down stop at the ends, with no wrap (T5 accepted; 4.11, 5.1, I19).
- **Tokens.** The off-scale list (2.9) and the geometry table (2.10) now name the `--source-test-*` and `--toolbar-*` tokens. Appendix A's content is unchanged. Its comments and those of `tokens.css` still say "Proposed (F9)", "Proposed (F15)" and "Proposed (B6)", which are stale. The token test compares comments too, so they can be fixed only by one comment-only change to both files, which is a `src/` change (open item for the PM).
- **Legacy residue.** None of the pre-009 control layer remains. The pre-009 stylesheets `src/styles/capture.css`, `src/styles/source.css` and `src/styles/sourceDialog.css` are gone; their rules live beside the components (`src/components/source/source.css`, `SourceDialog.css`, `src/ui/*`). `src/styles/` holds `app.css`, `tokens.css` and `tokens.test.ts`. The SplitButton geometry contract is `src/ui/SplitButton/SplitButton.geometry.test.ts` (moved and renamed in 009 QA). No alias is used outside `tokens.css` (2.19). Spacing literals in `app.css` are tokens (2.9, BUG-3).
- **Cross-references fixed.** 2.7 (A8, was Q-14), 2.19 (10.1 rule 7, was 8.1), 10.3 and 12.3 (test paths). 13.4: the `Popover.css` follow-up is done; its test follow-ups are not verified in this draft.
- **Register.** U1, I19, A10 and Q-23 added. D1, D2, P11, P12 and P13 updated (12.1, 12.2). 14 records F16 and F17.
- **Not reconciled in this draft.** `prototype/index.html` (illustrative, 0.1 rule 3) was not re-checked against draft 4; where it differs, this file wins.

### 13.0a Draft 3 (2026-11-16): implementation (work 009)

- **Status.** Implemented in tasks T1 to T11; visual QA (T13) pending. Version 1.0-draft.3. Outcomes of the open questions: `decisions.md` (PM), recorded in 12.1 and 12.2.
- **Applied.** Q-1 and Q-4 (F0, status bar removal order), Q-2 (copy), Q-3 (F9, 0.6), Q-15 (authority), Q-16 (token read in the canvas), Q-17 (live regions), Q-18 (no type-ahead in the source popover), Q-19 (peak table kept hidden), Q-13 (answered from ADR 0010, no change). Q-5 and Q-7 are recorded with no behaviour change.
- **Added fixes.** F16 (checkbox accent teal) and F17 (Center and Span value text primary), both accepted by the PM (4.4, 4.6).
- **Corrections.** 3.8 and 4.12: the dialog offset and inline padding are `--dialog-offset-top` and `--dialog-padding-inline`, not literals. 4.12: Save busy, the dialog's polite region, warnings as `role="status"`. 4.4: stacked labels are secondary. 4.11 and 5.1: Up, Down, Home and End in the source popover. 2.9: the known off-scale token values. 0.1: Q-15 decided.
- **Backlog (GitHub issues).** B3, B4, B5, B6 (Q-20), B8, Q-22 (option B), Q-7 (split), Q-8, Q-9, Q-10, Q-11 (with the `sweepIntervalMs` design), Q-12, Q-5 (zoom support), Q-21, custom tooltip, and the e2e items, tracked in GitHub issues.
- **Legacy residue.** Draft 3 said there was none and that the three pre-009 stylesheets were gone. Both were partly wrong (the names of what remains, and the test file names). Corrected in draft 4 (see below).

### 13.1 Draft 2 (2026-11-16): human review r1

**Why this draft exists.** The human reviewed draft 1 and asked for spec-grade rigour: correct accessibility claims, an unambiguous popover model, live regions that do not shout, valid tokens, a plot specification, performance and integrity rules, responsive ranges measured in the browser, and a governance model. Each item below is traced to the review section.

**Corrections of fact (found while measuring; each was wrong in draft 1):**

- `Uncalibrated` is **hidden** at every width from 1024 to 1257px, including 1180px (measured). Draft 1 and `design.md` said it was visible at 1180px; that was wrong. Section 3.4, W3, F0.
- The toolbar overlaps below about 780 CSS px (measured before 040, when it held the source button and the capture control). Draft 1 did not say so.
- The large-text definition: 24px regular or 18.67px bold, not 15px semibold (review 1). Section 9.2.
- The source selector is a popover with list semantics, not a menu (review 1). Sections 4.11, 5.1.
- Target sizes: the zoom reset (21.4px) and the checkbox label (19px) fail too, not only the small buttons (review 1). Section 9.9, F13, F14.
- The input and select boundary fails 3:1 (1.27 to 1.39:1) (review 1, WCAG 1.4.11). Section 9.4, F15.
- Secondary text on a hovered control is 4.38:1. Section 2.7.
- The disabled opacities were revisited: 0.45 gives a 3.48:1 label on the control fill; 0.6 gives 5.00:1 (review 1). Section 9.10, F9.
- The scrim token `rgba(0, 0, 0, 0.5 / 0.6)` was invalid CSS. Removed (T3, 2.4).
- The `EmptyState` component had no definition. Removed (4).
- "Keyboard selection is planned (see 11, A4)" pointed at a missing item. Replaced by 5.3.
- Plot: `Connecting…` shows "No source connected" on the plot and in the status bar today. Bug (B8).
- The toolbar has `role="toolbar"` with no roving focus (B7).
- Every banner had `role="alert"`; `Connect failed` and command errors were assertive (review 1). Section 9.6.
- A failed connection test in the dialog uses `role="alert"` (review 1). Section 9.6.

**Review sections and where they are addressed:**

| Review | Sections |
| --- | --- |
| 1. Critical corrections (P0): accessibility, menus, announcements, tokens | 2.4, 2.7, 2.15, 3.9, 5.1, 9.2 to 9.6, 9.9, 9.10 |
| 2. Interaction specifications: source lifecycle, readout selection, tooltips, patterns | 5.2, 5.3, 5.4, 5.5 |
| 3. Spectrum visualisation | 6 (new) |
| 4. Performance and measurement integrity | 7 (new), 6.1, 6.12 |
| 5. Responsive behaviour | 3.1 to 3.9 (measured ranges), 3.4 (status bar priorities), 3.6 (panel) |
| 6. Token architecture | 2.1, 2.18, Appendix A and B |
| 7. Inconsistencies | Section 14 (known gaps), 8.2, 12.2 |
| 8. Governance: authority, metadata, decision statuses | 0 (new), 12.1 |
| 9. Deliverables: changelog, open questions, examples | 12.2, 13, Appendix A |

**Structural changes.** Sections renumbered (map in 13.3). New sections: 0 (document control), 6 (spectrum), 7 (performance and integrity), 12 (register and open questions), 14 (known gaps), Appendices A to C. Components split into "Menu" (capture mode) and "Popover" (source). Tooltip moved to the deferred list.

**Status discipline.** Every decision has a status (0.3). Things that change current behaviour or add features are Proposed or Deferred. Work 009 scope is unchanged by this file: the behaviour changes are listed in `design.md` as B1 to B8 for the PM to scope.

### 13.2 Draft 1 (2026-11-16)

First draft: principles, the three token layers, colour and capture semantics, typography, spacing, radius, elevation, motion, z-index, components, interaction patterns, content, accessibility outline, governance, gap list and open decisions D1 to D6 and E1 to E5.

### 13.3 Section map, draft 1 to draft 2

| Draft 1 | Draft 2 |
| --- | --- |
| 1 Purpose and principles | 1 |
| 2.1 to 2.19 (tokens) | 2.1 to 2.19 (2.14 z-index; 2.15 opacity; 2.16 canvas-only values; 2.17 literals; 2.18 consumers and tests; 2.19 migration) |
| 3 Layout | 3.1 to 3.10 (3.2 width ranges; 3.9 scaling) |
| 4 Components | 4 (menu and popover split; tooltip deferred) |
| 5 Patterns and states | 5.1 to 5.10 (5.2 source lifecycle; 5.4 tooltips; 5.5 other patterns; 5.8 states) |
| (none) | 6 Spectrum visualisation (new) |
| (none) | 7 Performance and measurement integrity (new) |
| 6 Content and copy | 8 |
| 7 Accessibility | 9 |
| 8 Governance | 10 |
| 9 Checklists | 11 |
| 10 Gap list | 14 |
| 11 Open questions and decisions | 12 (register, questions, engineering items, assumptions) |
| (none) | 13 Changelog (this section) |

---

### 13.4 Ruling (2026-11-16): popover row geometry (work 009 T9)

- The row stays **44px** (`--row-height`). The T9 change to 52px is reverted in `tokens.css` and Appendix A.
- The row actions are **24 x 24** buttons in the **badge column**, **centred vertically**, shown on hover or focus. The badge fades out while they are shown. The actions no longer sit under the badge on line 2. Section 4.11, 2.10, 9.9.
- Rule change: "the actions never cover the badge" becomes "the actions replace the badge while shown; a visible badge is never covered". The badge is hidden in that state (opacity 0, as before 009).
- The fixed blocks (Signal simulator, Add source, Disconnect) keep **no visible heading** in 009. Section 4.11.
- Implementation follow-up (status checked in draft 4: the `Popover.css` change is done; the test follow-ups are not verified and QA checks them): `Popover.css` `.list-row-actions` (`top: calc(50% - var(--target-min) / 2)`, `bottom: auto`); `ListRow.test.tsx` (the test that pins bottom anchoring); the visual e2e test "hover actions sit below the badge pill" (assert the badge opacity is 0 while the actions show, and that the actions are inside the badge column).

## 14. Known gaps: this file against the app before and after 009

Each gap is either a small fix (`design.md` F-list), a behaviour change (B-list), a bug, or a feature item. Measured where a number is given. Where the "After 009" column says Backlog, the rule in the sections above is the target and the "Before 009" column is still what ships.

| Gap | Before 009 (measured or read in code) | Target | Item | After 009 |
| --- | --- | --- | --- | --- |
| Status bar cuts `Uncalibrated` from 1024 to 1257px | Cut (measured) | Visible at every supported width | F0, W3 (bug) | Resolved in 009 (F0) |
| Toolbar overlaps below about 780 CSS px | Overlap at 683 and 512 CSS px (measured) | Reflow or a decision | Q-5 | Not in 009: zoom unsupported (Q-5) |
| Source button is `role="menu"`-style, `aria-haspopup="menu"` | Yes (`SourceButton.tsx`) | Dialog-style popover | B1 | Resolved in 009 (B1) |
| Row actions are `menuitem` | Yes (`SourceMenu.tsx`) | Ordinary buttons | B1 | Resolved in 009 (B1) |
| Every banner is `role="alert"` | Yes (`NoticeBanner.tsx`) | Assertive only for DeviceLost, AcquisitionFailed, Internal | B2 | Resolved in 009 (B2) |
| Connect form error is `role="alert"` | Yes (`SourceForm.tsx`) | Polite | B2 | Resolved in 009 (B2) |
| Dialog test failure is `role="alert"` | Yes (`SourceDialog.tsx`) | Polite | B2 | Resolved in 009 (B2) |
| Toolbar `role="toolbar"` without roving focus | Yes (`Toolbar.tsx`) | `<header>` | B7 | Resolved in 009 (B7) |
| Connecting shows "No source connected" | Yes (`liveness.ts`, `StatusBar.tsx`) | "Connecting…" | B8 | Backlog (B8) |
| Start-up shows "Choose a source" before the backend answers | Yes (`SourceButton.tsx`) | "Loading…" | B3 | Backlog (B3) |
| Peak table grows the side panel | Yes | Capped at eight rows | B5 | Backlog (B5) |
| Notice stack grows without a limit | Yes | Capped at 96px | B6 | Backlog (B6, Q-20) |
| Stale threshold 2 s fixed | Yes (`liveness.ts`) | Per source or reported (Q-11) | P14 | Backlog (Q-11) |
| Marker and peak readouts keep old values when stale | Yes | Show "Last data" (Deferred) | P12 | Backlog (P12, prioritised) |
| Frequency axis labels pick their own unit | Yes (`spectrumRenderer.ts`, `formatFrequency`) | One unit per axis | P11 | Backlog (P11) |
| Max and min hold traces differ by colour only | Yes | Dashed and dotted (Proposed) | P9 | Backlog (Q-9) |
| Waterfall has no colour scale | Yes | Colour strip (Proposed) | P10 | Backlog (Q-10) |
| Peak click moves the active marker | Yes (`PeaksPanel.tsx`) | Split (Q-7) | I11 | Kept (Q-7); split in the backlog |
| Switching source while acquiring stops the acquisition with no notice | Yes (`session.ts`, rows enabled) | Open (Q-22) | I8 | Kept (option A) until the backlog item (Q-22) |
| Marker and peak rows are not keyboard reachable | Yes | Id cell buttons (Proposed) | B4 | Backlog (B4) |
| Zoom reset button 21.4px | Yes (measured) | 24px | F13 | Resolved in 009 (F13) |
| Checkbox label 19px | Yes (measured) | 24px | F14 | Resolved in 009 (F14) |
| Marker × 20px tall; notice dismiss 20px tall | Yes (measured) | 24px | F2 | Resolved in 009 (F2) |
| Input and select boundary 1.27 to 1.39:1 | Yes (computed) | 3:1 | F15 | Resolved in 009 (F15) |
| Disabled inputs 0.5, buttons 0.45, locked chevron 0.55 | Yes (CSS) | One value, 0.6 | F9 | Resolved in 009 (F9) |
| Side-panel selects 26px; number inputs 28.2px | Yes (measured) | 28px | F1 | Resolved in 009 (F1) |
| Toolbar Center 28.2px and Span 26px | Yes (measured) | 30px | F1 | Resolved in 009 (F1) |
| Menu focus ring inside the mode items | Yes (`capture.css`) | Outside, 1px offset | F4 | Resolved in 009 (F4) |
| Status bar 11.5px | Yes (`app.css`) | 11px | F5 | Resolved in 009 (F5) |
| Unused `--warn-strong` | Yes (`app.css`) | Removed | F12 | Resolved in 009 (F12) |
| Literal colours outside `:root` | Yes (about 25 values across the CSS files) | None outside the token file | E1 | Resolved in 009 (E1; guard in `tokens.test.ts`) |
| Canvas holds a copy of six token values | Yes (`theme.ts`) | Read from the token file | E3 | Resolved in 009 (E3) |
| Canvas draws what is in the data; no smoothing | Met (`envelope.ts`) | Kept | 6.1 | Kept |
| Amplitude axis auto-scale | None (`view.ts`: reference and range set by the user) | Kept | 6.1 | Kept |
| `docs/README.md` does not link this file | Yes | Linked | 10.5 (PM) | Resolved in 009 (T12) |
| Canvas and waterfall `role="img"` names do not state values | Yes | Kept (values are in the readouts) | 9.12 | Kept (9.12) |
| Checkbox accent is the WebKit default blue | Yes | `--color-accent` (teal) | F16 | Resolved in 009 (F16) |
| Center and Span values inherit the secondary colour | Yes | Primary text | F17 | Resolved in 009 (F17) |
| Peak Search, Next peak and + Marker are native-disabled | Yes | Reason visible on the same screen (9.10) | A10 | Accepted deviation (T6); QA to confirm |
| Frequency step and Reference level are in Source settings, not Measurement | Yes (`SourcePanel.tsx`, `ParamForm.tsx`) | In Measurement, after Span, for a trace source (014) | 014 | Target (draft 5); not yet implemented |
| FFT size and Window shown disabled for a trace source | Yes (013) | Hidden for a trace source (014) | 014 | Target (draft 5) |
| Unit of a NumberField is visible only | Yes (`NumberField.tsx`) | Linked by `aria-describedby` (4.4) | 014 | Target (draft 5) |
| Start-up shows "Choose a source" | Yes (`SourceButton.tsx`) | "Loading…" (B3 pulled into 015) | 015 | Target (draft 5); Proposed |
| No source selected after disconnect or forget | Yes (`sources.ts`, `SourceButton.tsx`) | A source is always selected (5.2.2 S13, 5.2.10) | 015 | Target (draft 5); Approved (#46) |
| Auto-connect never replaces a source (ADR 0014) | Yes | Any idle simulator is replaced (015, M22) | 015 | Target (draft 5); ADR 0017 |

---

## Appendix A. Token file (normative)

The implemented file (`src/styles/tokens.css`) must equal this block. A test compares them (2.18, rule 5).
Values and comments are the implemented ones. The test compares the block with `tokens.css`, comments included, so the two change together.

```css
/* tokens.css. Normative: DESIGN.md Appendix A. Define tokens here only. */
:root {
  /* 2.2 Primitives: colour */
  --palette-night-900: #0b1018;
  --palette-night-850: #0e1520;
  --palette-night-800: #121a26;
  --palette-night-750: #182233;
  --palette-night-700: #1f2b3f;
  --palette-night-650: #25344c;
  --palette-night-600: #26344a;
  --palette-night-550: #3a4d6b;
  --palette-slate-600: #5b6f8f; /* Approved (F15): input boundary */
  --palette-slate-500: #7a8799;
  --palette-slate-400: #8a9ab1;
  --palette-slate-350: #8ea0b8; /* canvas axis text */
  --palette-slate-100: #dbe4f0;
  --palette-slate-050: #e6edf6; /* canvas readout text */
  --palette-teal-400: #3ee0b5;
  --palette-teal-500: #2bc79e;
  --palette-ink-teal: #062018;
  --palette-amber-400: #ffb547;
  --palette-red-400: #ff6b6b;
  --palette-red-500: #f04848;
  --palette-blue-400: #5aa9ff;
  --palette-violet-400: #a47cff;
  --palette-violet-500: #9166f5;
  --palette-ink-dark: #120a24;
  --palette-orange-400: #ff9f43;
  --palette-magenta-400: #ff6bcb;
  --palette-yellow-300: #ffd166;
  --palette-white: #ffffff;

  /* 2.3 Semantic colour */
  --color-surface-app: var(--palette-night-900);
  --color-surface-panel: var(--palette-night-800);
  --color-surface-raised: var(--palette-night-750);
  --color-surface-control: var(--palette-night-700);
  --color-surface-control-hover: var(--palette-night-650);
  --color-surface-plot: var(--palette-night-850);
  --color-border-default: var(--palette-night-600);
  --color-border-hover: var(--palette-night-550);
  --color-border-input: var(--palette-slate-600); /* Approved (F15) */
  --color-text-primary: var(--palette-slate-100);
  --color-text-secondary: var(--palette-slate-400);
  --color-text-on-accent: var(--palette-ink-teal);
  --color-text-on-violet: var(--palette-ink-dark);
  --color-text-on-danger: var(--palette-ink-dark);
  --color-accent: var(--palette-teal-400);
  --color-accent-hover: var(--palette-teal-500);
  --color-warn: var(--palette-amber-400);
  --color-danger: var(--palette-red-400);
  --color-danger-hover: var(--palette-red-500);
  --color-info: var(--palette-blue-400);
  --color-focus-ring: var(--palette-blue-400);
  --color-capture-continuous: var(--color-accent);
  --color-capture-continuous-hover: var(--color-accent-hover);
  --color-capture-single: var(--palette-violet-400);
  --color-capture-single-hover: var(--palette-violet-500);
  --color-capture-stop: var(--color-danger);
  --color-capture-stop-hover: var(--color-danger-hover);

  /* 2.4 Derived colour (explicit values) */
  --color-tint-ok: rgba(62, 224, 181, 0.08);
  --color-tint-ok-strong: rgba(62, 224, 181, 0.16);
  --color-tint-warn: rgba(255, 181, 71, 0.12);
  --color-tint-error: rgba(255, 107, 107, 0.12);
  --color-tint-error-subtle: rgba(255, 107, 107, 0.08);
  --color-halo-ok: rgba(62, 224, 181, 0.28);
  --color-halo-info: rgba(90, 169, 255, 0.35);
  --halo-ok: 0 0 0 2px var(--color-halo-ok);
  --halo-info: 0 0 0 2px var(--color-halo-info);
  --color-border-danger-muted: rgba(255, 107, 107, 0.45);
  --color-divider-on-teal: rgba(6, 32, 24, 0.35);
  --color-divider-on-violet: rgba(18, 10, 36, 0.35);
  --color-scrim-modal: rgba(5, 8, 14, 0.6);
  --color-scrim-chip: rgba(8, 12, 18, 0.8);
  --color-scrim-readout: rgba(8, 12, 18, 0.88);

  /* 2.6 and 6.3 Data colour (canvas and DOM twins) */
  --color-trace-live: var(--palette-teal-400);
  --color-trace-live-fill: rgba(62, 224, 181, 0.1);
  --color-trace-stale: var(--palette-slate-500);
  --color-trace-max-hold: var(--palette-orange-400);
  --color-trace-min-hold: var(--palette-blue-400);
  --color-marker: var(--palette-magenta-400);
  --color-marker-active: var(--palette-white);
  --color-peak: var(--palette-yellow-300);
  --color-grid: rgba(120, 150, 190, 0.14);
  --color-grid-strong: rgba(120, 150, 190, 0.28);
  --color-crosshair: rgba(220, 230, 245, 0.45);
  --color-text-axis: var(--palette-slate-350);
  --color-text-readout: var(--palette-slate-050);

  /* 2.7 Focus */
  --focus-ring-width: 2px;
  --focus-ring-offset: 1px;
  --focus-ring-offset-group: 2px;

  /* 2.8 Typography */
  --font-family-ui: 'Inter', 'Cantarell', 'Ubuntu', system-ui, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'DejaVu Sans Mono', ui-monospace, monospace;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-lg: 15px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --letter-spacing-caps: 0.06em;
  --letter-spacing-chip: 0.05em;
  --letter-spacing-brand: 0.02em;
  --line-height-body: 1.4;
  --line-height-title: 1.3;

  /* 2.9 Spacing */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 12px;
  --space-6: 16px;
  --space-7: 24px;

  /* 2.10 Geometry */
  --control-height: 30px;
  --control-height-small: 24px;
  --target-min: 24px;
  --field-height-compact: 28px;
  --glyph-cell: 18px;
  --glyph-dot: 10px;
  --row-height: 44px;
  --row-height-single: 30px;
  --row-gap: 3px; /* Off-scale, as before 009: space between popover rows (pitch 47px) */
  --panel-width: 330px;
  --popover-width: 360px;
  --popover-width-mode: 280px;
  --dialog-width: 440px;
  --dialog-offset-top: 90px;
  --dialog-padding-inline: 18px;
  --badge-column: 64px;
  --capture-main-width: 128px;
  --capture-chevron-width: 26px;
  --capture-main-gap: 7px; /* Off-scale, kept from before T7: icon to label */
  --capture-main-padding-x: 10px; /* Off-scale, kept from before T7 */
  --field-width-inline: 140px;
  --field-width-unit: 90px;
  --field-width-param: 140px;
  --field-padding-frequency: 7px; /* Off-scale, kept from before T7: frequency field inline padding */
  --plot-chip-inset-top: 14px;
  --plot-chip-inset-right: 22px;
  --plot-tag-padding-x: 9px; /* Off-scale, kept from before 009: plot tag inline padding */
  --notice-stack-max: 96px; /* Deferred (B6): not used in 009 */
  --source-test-min-height: 62px; /* Off-scale, as before 009: test result box, reserved for idle and ok */
  --source-test-gap: 10px; /* Off-scale, as before 009: Test connection button to result box */
  --source-test-padding-y: 5px; /* Off-scale, as before 009: test result box vertical padding */
  --toolbar-padding-x: 12px;
  --toolbar-padding-y: 7px; /* Off-scale, kept from before 009: toolbar vertical padding */
  --plot-zoom-reset-inset-left: 76px; /* Zoom reset, from the left of the plot */
  --plot-hint-padding-x: 40px; /* Plot hint: horizontal inset, so the text wraps clear of the plot edges */
  --waterfall-tick-gap: 3px; /* Off-scale, kept from before 009: waterfall tick label to its mark */
  --legend-swatch-width: 10px; /* Off-scale, kept from before 009: legend swatch of a hold trace */
  --legend-swatch-height: 3px; /* Off-scale, kept from before 009: legend swatch of a hold trace */
  --button-icon-slot: 12px; /* Button icon slot: the icon and the spinner take the same box */
  --menu-end-column: 16px; /* Menu item: the trailing column (shortcut or mark) */
  --status-dot-ring-width: 2px; /* Absent status dot: the ring width */
  --source-row-sub-min-height: 17px; /* Source row line 2: keeps its line when empty */

  /* 2.11 Radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-round: 50%;

  /* 2.12 Elevation */
  --elevation-none: none;
  --elevation-popover: 0 12px 36px rgba(0, 0, 0, 0.5);
  --elevation-modal: 0 16px 48px rgba(0, 0, 0, 0.6);

  /* 2.13 Motion */
  --motion-duration-instant: 0ms;
  --motion-duration-fast: 150ms;
  --motion-duration-pulse: 1000ms;
  --motion-duration-spin: 1000ms;
  --motion-duration-highlight: 3000ms;
  --motion-pulse-opacity-min: 0.25;
  --motion-ease-standard: ease-out;
  --motion-ease-loop: ease-in-out;
  --motion-ease-linear: linear;

  /* 2.14 Z-index */
  --z-base: 0;
  --z-overlay: 10;
  --z-popover: 20;
  --z-modal: 40;
  --z-tooltip: 60;

  /* 2.15 Opacity states */
  --opacity-unavailable: 0.6; /* Approved (F9); before 009: 0.45, 0.5, 0.55 */
  --opacity-read-only: 0.75;
}

/* 2.10 Narrow window (range C, max-width 1180px, inclusive) */
@media (max-width: 1180px) {
  :root {
    --toolbar-padding-x: 8px;
  }
}

/* alias: migration only */
/* Migration aliases (2.19). Defined for one release, then removed. No CSS outside this file may use
   them (tokens.test.ts). */
:root {
  --bg: var(--color-surface-app);
  --surface: var(--color-surface-panel);
  --surface-2: var(--color-surface-raised);
  --surface-3: var(--color-surface-control);
  --border: var(--color-border-default);
  --text: var(--color-text-primary);
  --text-muted: var(--color-text-secondary);
  --accent: var(--color-accent);
  --accent-strong: var(--color-accent-hover);
  --warn: var(--color-warn);
  --danger: var(--color-danger);
  --danger-strong: var(--color-danger-hover);
  --danger-ink: var(--color-text-on-danger);
  --info: var(--color-info);
  --single: var(--color-capture-single);
  --single-strong: var(--color-capture-single-hover);
  --single-ink: var(--color-text-on-violet);
  --radius: var(--radius-md);
  --font: var(--font-family-ui);
  --mono: var(--font-family-mono);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-pulse: 0ms;
  }
}
```

Note on the last block: under reduced motion the pulse duration is zero. The pulse is replaced by a
static halo in the components (2.13). The duration token is kept for the components that need it.

---

## Appendix B. Canvas token map (`src/plot/theme.ts`)

| `PLOT_THEME` key today | Value today | Token | Status |
| --- | --- | --- | --- |
| `background` | `#0b1018` | `--color-surface-app` | Approved (E3) |
| `plotBackground` | `#0e1520` | `--color-surface-plot` | Approved |
| `grid` | `rgba(120, 150, 190, 0.14)` | `--color-grid` | Approved (decorative) |
| `gridStrong` | `rgba(120, 150, 190, 0.28)` | `--color-grid-strong` | Approved (decorative) |
| `axisText` | `#8ea0b8` | `--color-text-axis` | Approved (T8) |
| `liveTrace` | `#3ee0b5` | `--color-trace-live` | Approved |
| `liveFill` | `rgba(62, 224, 181, 0.10)` | `--color-trace-live-fill` | Approved |
| `staleTrace` | `#7a8799` | `--color-trace-stale` | Approved |
| `maxHold` | `#ff9f43` | `--color-trace-max-hold` | Approved |
| `minHold` | `#5aa9ff` | `--color-trace-min-hold` | Approved (own token, E2) |
| `peak` | `#ffd166` | `--color-peak` | Approved |
| `marker` | `#ff6bcb` | `--color-marker` | Approved |
| `markerActive` | `#ffffff` | `--color-marker-active` | Approved |
| `crosshair` | `rgba(220, 230, 245, 0.45)` | `--color-crosshair` | Approved |
| `readoutBackground` | `rgba(8, 12, 18, 0.88)` | `--color-scrim-readout` | Approved |
| `readoutText` | `#e6edf6` | `--color-text-readout` | Approved |
| `font` | `11px "Inter", ...` | `--font-size-xs` and `--font-family-ui` (built at runtime) | Approved |
| `monoFont` | `11px "JetBrains Mono", ...` | `--font-size-xs` and `--font-family-mono` (built at runtime) | Approved |

Not in the token map (kept in TypeScript, by design):

- `PLOT_INSETS` (plot geometry: left 64, right 14, top 10, bottom 26): layout values of the plot, not design tokens.
- The waterfall LUT stops (`src/plot/colormap.ts`): data encodings (9.5).
- Tick density constants (110 px and 36 px per tick): plot geometry (6.2).
