# 014 design: Frequency step and Reference level in Measurement; hide unused rows (#45)

Status: design delta, for the PM and the human. No prototype: minor layout change (the design gate is this file and the DESIGN.md 3.6 text). Normative text is in `DESIGN.md` sections 3.6, 4.4, 5.8, 8.5, 12, 13 and 14 (draft 1.0-draft.5). Where this file and DESIGN.md differ, DESIGN.md wins.

## 1. User flow and entry points

- Entry: the side panel, Measurement section (open by default). The user tunes Center, Span and the source's own measurement settings in one place.
- Flow: open the side panel, read Measurement top to bottom, change Frequency step (SA430) or FFT size (IQ source). Each change commits as it does today in Source settings (Enter or blur).
- Source settings no longer holds Frequency step or Reference level.

## 2. Layout

Measurement, connected SA430 (trace source), panel 330px, label column left, control right (140px; 90px with a unit):

```
v Measurement
  [ ● SA430 08FF41E50F8B3A34                 ▾ ]   source button, 305px, name ellipsis
  Center           [ 868.000000 MHz            ]
  Span             [ 10 MHz                  ▾ ]
  Frequency step   [ 100            kHz        ]   NEW here (was Source settings)
  Reference level  [ -35 dBm                 ▾ ]   NEW here (was Source settings)
  Averaging        [ 10          traces       ]
  [ ] Max hold  [ ] Min hold  [Reset]
  [ Continuous                             ▾ ]   capture control, full width
```

Measurement, connected simulator (IQ source). The two kind rows are FFT size and Window; the rows for the SA430 are absent, not disabled:

```
v Measurement
  [ ● Signal simulator                       ▾ ]
  Center           [ 2.400000000 GHz           ]
  Span             [ 10 MHz                  ▾ ]
  FFT size         [ 4096                    ▾ ]
  Window           [ Hann                    ▾ ]
  Averaging        [ 10          traces       ]
  [ ] Max hold  [ ] Min hold  [Reset]
  [ Continuous                             ▾ ]
```

Both kinds have two kind rows, so the Measurement block is the same height for either source and the capture control does not move when the kind changes.

Disconnected, selected SA430 (kind known from this run; see section 4):

```
  [ ○ SA430 08FF41E50F8B3A34                 ▾ ]
  Center           [ —                         ]  disabled
  Span             [ —                         ]  disabled
  Frequency step   [ —                 kHz     ]  disabled, reason in description
  Reference level  [ —                       ▾ ]  disabled
  Averaging        [ 10          traces       ]  enabled
  [ ] Max hold  [ ] Min hold  [Reset]            enabled
  [ Continuous                            ▾ ]  unavailable
```

Rules for the layout:

- DOM order is visual order: source button, Center, Span, kind rows, Averaging, hold row, capture control.
- A hidden row is removed from the DOM. It is not `aria-hidden`, not disabled, and not kept as an empty slot.
- Labels: `Frequency step` and `Reference level` fit the label column with the 140px control (the room is 305px less 140px, DESIGN.md 3.2). Not yet measured: QA checks at 1024, 1180 and 1440 windows.

## 3. Components

| UI element | Component | Status |
| --- | --- | --- |
| Source button | `SourceButton` (existing) | Unchanged |
| Center, Span | `Field` with `FrequencyField` and `Select` (existing) | Unchanged |
| Frequency step | `Field` + `NumberField`, `unit="kHz"`, `inline`, through the same generic `ParamField` that Source settings uses today | Existing component. Feature change: `ParamField` is exported (or the Measurement group uses it) so the row is not a copy. Flat list, no `fieldset` frame |
| Reference level | `Field` + `Select` with the driver's options (`-35 dBm` …), through `ParamField` | Existing component, same as above |
| FFT size, Window | `Select` (existing) | Now rendered only for an IQ source. The "disabled for a trace source" branch is removed (013 F5 is replaced for trace sources) |
| Averaging | `NumberField` (existing) | Unchanged position; shown for both kinds |
| Max hold, Min hold, Reset | `Checkbox`, `Button` (existing) | Unchanged (assumption, Q-29: shown for both kinds) |
| Capture control | `CaptureControl` (existing) | Unchanged |
| Source settings when empty | `InlineMessage variant="hint"` (existing) | Copy unchanged (section 5 below) |
| Unit announcement | `NumberField` `unit` suffix | Feature-level behaviour change in `src/ui/Field`: the unit is linked with `aria-describedby` (see 6). Proposed DESIGN.md 4.4 |

New `src/ui` components: none. The rows are existing fields and the feature composes them. Reason: no new interaction pattern; the need is a placement rule, which belongs to the feature.

Proposed DESIGN.md changes (done in the same change set as this file): 3.6 Measurement text and kind-row rule; 4.4 unit announcement and the em dash for device values with no source; 5.8 copy for the Source settings hint; 8.5 glossary entries for the two "Reference level" meanings; 12 register and 12.2 questions; 13 changelog; 14 gaps.

## 4. Which rows show (the rule)

The rows follow the kind of the selected source, as the source reports it. The UI never checks a device name.

| Selected source reports | Measurement rows, in order |
| --- | --- |
| Measured traces (trace kind) | Center, Span, Frequency step, Reference level, Averaging, hold row, capture |
| Computed from IQ (IQ kind) | Center, Span, FFT size, Window, Averaging, hold row, capture |
| Not known yet (start-up, or no connection since launch) | Center, Span, Averaging, hold row, capture. No kind rows |

"Which rows" is a property of the source the user selected, not of the connection. While it is not connected, the last reported kind is used (014 section 5, and 015 S13). Mechanism (staff engineer): the source reports which of its runtime settings are measurement rows (a placement marker on each spec, for example) and its data kind (`dataKind`, already reported). The UI reads those; it does not read `driverId`.

## 5. Source settings after 014

- Frequency step and Reference level leave Source settings.
- For a connected SA430, Source settings has no rows. It shows the existing hint: "This source has no additional settings." It stays, closed by default, in the same place. Reason: sections keep a stable order, and the hint is accurate. Open: Q-26 (hide the section instead).
- For a simulator, unchanged: "This source has no additional settings."

## 6. All states

Measurement rows by state. "Kind" means the kind rows in section 4.

| State | Source button | Center, Span | Kind rows | Averaging, hold row | Capture control |
| --- | --- | --- | --- | --- | --- |
| Loading (start-up, Proposed in 015) | "Loading…", no dot | Em dash, disabled | None | Not shown until the processing settings are known | Unavailable, reason "Loading…" |
| Empty (no source connected, nothing selected) | Not reachable after start-up (015) | n/a | n/a | n/a | n/a |
| Connecting | Name, "Connecting…" | Em dash, disabled | Last known kind, disabled, reason "Connecting…" (*) | Enabled | Unavailable, "Connecting…" |
| Connected | Name, "Connected" | Values, enabled | Enabled, values | Enabled | Enabled |
| Acquiring | Name, "Acquiring" | Enabled | Enabled | Enabled | Enabled |
| Applying (a change in flight) | As before | The changed control is read-only (`readonly`, focus stays) | Same, read-only | Same | Same |
| Apply error | As before | Value returns to the device's value | Same | Same | Same |
| Error (connect failed) | "Failed" | Em dash, disabled | Last known kind, disabled, reason "Connect a source first" (*) | Enabled | Unavailable |
| Disconnected (selected) | Name, idle dot | Em dash, disabled | Last known kind, disabled, reason "Connect a source first" (*) | Enabled | Unavailable |
| Device lost | "Not detected" | Em dash, disabled | Last known kind, disabled (*) | Enabled | Unavailable |

(*) The table is the target. Today the kind rows show only when the source was opened in this run (its kind is known). A source not opened this run (a device that failed at launch, or a remembered device after a restart) has its kind rows hidden, and only the rows every source has are shown. Showing those rows disabled is follow-up issue #47 (PM decision after the SA430 run, 015).

Details:

- Apply error: the same as Source settings today. The error goes to the command banner (command severity, DESIGN.md 5.7). The control keeps focus and shows the device's value again. No inline error is added.
- Validation: the same as today. A value outside the driver's range (from the spec: 10 to 500 kHz for Frequency step) is not sent. The range is shown in the field's units, for example "Allowed range: 10 kHz – 500 kHz" (4.4). Enter keeps the invalid entry visible; blur reverts it; Escape reverts.
- Em dash: a device value is shown as `—` and the control is disabled when no source is connected. Frequency step is a `NumberField` with no value; Reference level is a `Select` with one `—` option, as Span does today.
- FFT size and Window keep their processing values with no source (they are the app's, not the device's).
- Averaging and the hold row stay enabled with no source (3.6).

### Focus when a kind row disappears

A kind row disappears only when the selected source's kind changes (for example, a device replaces the simulator). If focus is in that row:

1. Focus moves to the next control in Measurement in DOM order (Averaging for both kinds).
2. If there is none, focus moves to the source button.

No live announcement is added for this. The source button's name is current when focused.

## 7. Copy (exact)

| Item | Text |
| --- | --- |
| Frequency step label | "Frequency step" (the driver's label; see Q-24) |
| Frequency step unit | "kHz" |
| Reference level label | "Reference level" (the driver's label; see Q-25) |
| Reference level options | "-35 dBm" and the driver's others, dBm |
| Driver help (both rows) | The driver's `help` text, unchanged. It is the accessible description too (section 8) |
| Disabled reason | "Connect a source first", "Connecting…", "Disconnecting…" (existing; 3.6) |
| Range message | "Allowed range: <min> – <max>" in kHz (4.4 format) |
| Source settings, empty | "This source has no additional settings." (existing; unchanged) |
| Source settings, no source | "Connect a source to see its settings." (replaces "Choose a source to see its settings."; decided in 015) |

No other new copy. Units follow CLAUDE.md: the device level is dBm, reported by the SA430 and calibrated by the device. The plot's Reference level has no unit and stays in Display (section 9).

## 8. Interaction, keyboard and screen reader

Keyboard:

- Tab order: source button, Center, Span, the kind rows, Averaging, Max hold, Min hold, Reset, capture main, capture chevron. This is the visual order, so the acceptance criterion holds without a `tabindex`.
- Frequency step: ArrowUp and ArrowDown step by the spec's step (5 kHz) when there is no draft (4.4). Enter commits and keeps focus. Escape reverts.
- Reference level: native select. Arrow keys change the value.
- No new shortcut.

Screen readers:

- Each row is announced with its label, value, and unit: "Frequency step, kHz, 100, spin button". Today the unit is visible only, so the unit is linked with `aria-describedby` to visually hidden text (4.4 change, applies to Averaging "traces" and Range "dB" too).
- The driver help is the accessible description, not only a `title`. Today `ParamField` uses `title` only. Change in `ParamForm.tsx`.
- Reference level appears twice in the panel (Measurement and Display). The two controls are told apart by their value (`-35 dBm`), their description (the help text) and their group. See Q-25.
- Hidden rows are not announced at all (they are not in the tree).

Contrast and signals:

- Labels use `--color-text-secondary` as today. Disabled rows use `--opacity-unavailable` (0.6, F9) with the reason in the description and in the tooltip (5.4: the description carries it).
- No colour-only signal. The em dash and the disabled state carry "no value" in text and in the control state.

## 9. Acceptance criteria mapping

| Acceptance criterion (#45) | Design element |
| --- | --- |
| Connected SA430: rows Center, Span, Freq. step, Reference level, Averaging; source button first, hold row and capture last | Section 2 (wireframe), section 4 (trace row) |
| Connected SA430: Frequency step and Reference level are gone from Source settings | Section 5 |
| Simulator: Center, Span, FFT size, Window, Averaging; no Freq. step, no Reference level | Section 2, section 4 (IQ row) |
| Any source: a setting it does not use is hidden, not disabled | Section 2 (rule: removed from the DOM), section 4 |
| Changing Freq. step or Reference level applies as from Source settings (validation, errors, focus) | Section 6 (apply, error, validation), the same `ParamField` |
| Keyboard order follows visual order; screen readers announce label and unit | Section 8 |

## 10. Open questions and assumptions

- **Q-24, label "Frequency step" or "Freq. step".** The approved order says "Freq. step". This file uses the driver's label "Frequency step" (the story's own name, the full word fits, and the UI does not rename device labels). Designer's recommendation: "Frequency step". Human or PM to confirm.
- **Q-25, two "Reference level" labels.** Designer's recommendation: keep both (minimal copy). The device row is in Measurement with dBm options, the plot row is in Display with a plain number; the glossary (8.5) defines both meanings; the device help text is the description. Alternative: the driver's label becomes "Input level" (a driver change owned by the staff engineer and the driver).
- **Q-26, Source settings when empty for a connected SA430.** Designer's recommendation: keep the section and its hint. Alternative: hide the section for a source with no source-only settings.
- **Q-29, hold row for trace sources.** Assumption: shown for both kinds, because the trace pipeline applies averaging and holds to trace sources (`crates/spectrum-core/src/session/pipeline.rs`). The approved per-source lists omit the hold row; this file keeps it, as the order says.
- **Mechanism (staff engineer).** The UI needs (a) a per-setting placement from the source (measurement row or source-only) and (b) the selected source's data kind while disconnected. (b) is either reported by the backend or remembered by the UI for the run; the designer prefers the backend.
- **Assumption.** Frequency step and Reference level keep their driver validation (min, max, step) and their commit path (`applySettings` with `params`). No new IPC.
- **Assumption.** Layout is measured by QA, not in this file: the label column fits "Frequency step" and "Reference level" at 1024, 1180 and 1440.
