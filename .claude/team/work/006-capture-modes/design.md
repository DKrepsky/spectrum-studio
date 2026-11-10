# 006 Capture modes (Single / Continuous): design

Status: design for the human gate. Prototype: `prototype/index.html` (scenario switcher, clickable).
Screenshots: `prototype/screenshots/`. Story: `story.md`. Builds on 003 (icon-only Play/Pause).

## 1. Recommendation in one paragraph

Keep the human's split button: one control with a **mode label + play/pause/cancel icon** on the left
and a **chevron** on the right that opens a two-item radio menu. The mode sets the **fill colour**
(teal = Continuous, purple = Single). The **action state** (idle, acquiring, capturing) is carried by
the **icon, the label's accessible name and the plot badge**, never by colour. Single starts one
capture and the backend stops it after one completed trace; the trace is then held with the existing
`HOLD` badge. The mode is locked while acquiring, and choosing a mode never starts a capture.

Two changes to the human's sketch, flagged for the gate:
- **Pause is no longer amber.** Today's Pause is amber (`button.primary.stop`). If colour means mode,
  amber cannot also mean "running". Running is shown by the Pause icon and the LIVE badge. Amber stays
  for warnings (waiting/stale). See open question Q1.
- **A cancel is shown as Stop (■), not Pause.** A single sweep cannot be paused or resumed, so the
  running single capture shows a square Stop icon and the accessible name "Cancel single capture".

## 2. User flows and entry points

| Flow | Steps |
| --- | --- |
| First run | Toolbar shows `▶ Continuous ▾` (default). Nothing changes for current users. |
| One clean trace | Chevron (or ↓ on the chevron) → choose `Single` → Esc/Enter returns to the button → ▶ `Single`. The sweep arrives, the trace is held (`HOLD · last data hh:mm:ss`), the button is idle purple again. |
| Live monitoring | `▶ Continuous` → `❚❚ Continuous` (LIVE). ❚❚ holds the last trace. |
| Cancel a single capture | While ■ `Single` shows, press ■. The previous trace stays. |
| Change mode while running | Not possible: the chevron is locked. Pause or cancel first (tooltip says so). |
| Restart after failure | Notice bar `Restart` runs the current mode (here Single). |

Entry points: the toolbar capture control only. No new shortcut (out of scope). `Ctrl+K` (source menu)
is unchanged.

## 3. Layout

### 3.1 Toolbar (1440 and 1024)

```
 ▲ Spectrum Studio  [● SA430 · /dev/ttyACM0 ▾] [ ▶ Continuous │ ▾ ]  Center [100.000000 MHz]  Span [2.048 MHz ▾]
                                                 └── main 128px ──┘└26px┘
                                                  ▶ Single  │ ▾       (purple, same geometry)
                                                  ■ Single  │ ▾       (capturing: Stop)
                                                  ❚❚ Continuous │ ▾   (acquiring: Pause, teal)
```

- One control, height `--control-height` (30px), the same height as the source button.
- Main segment: fixed **128px** wide, icon 12px (inline SVG, as 003), 7px gap, 13px 600-weight label
  centred. Left corners 6px, right corners square.
- Chevron segment: **26px**, 12px chevron SVG, right corners 6px. 1px divider in dark ink (35%).
- Fixed widths mean `Continuous` ↔ `Single` and Play ↔ Pause never move the chevron, the Center field
  or the source name. Total 154–155px (was 30px for the icon-only Play). The extra ~125px is paid for
  by the source name, which already has a shrink rule (`.toolbar-source`), so no other control moves.
- Width budget (measured in the prototype with headless Chrome, which falls back to the Ubuntu font
  here, so QA must re-measure in WebKitGTK): no toolbar overflow at 1024 for simulator + SIMULATED,
  for `SA430 · /dev/ttyACM0` (128px, no ellipsis) and for a 70-character name (213px, ellipsis).
  The bare name `SA430 08FF41E50F8B3A34` (22 characters) is not measured separately; it should fit
  inside the 213px available, and QA must confirm it in the real app (Q8).

### 3.2 Tokens

| Use | Token | Value |
| --- | --- | --- |
| Continuous fill, border | `--accent` | `#3ee0b5` |
| Continuous hover | `--accent-strong` | `#2bc79e` |
| Single fill, border (**new**) | `--single` | `#a47cff` |
| Single hover (**new**) | `--single-strong` | `#9166f5` |
| Label/icon ink on both fills | Continuous `#062018`, Single `--single-ink` `#120a24` (**new**) | |
| Capturing badge (**new**) | `--single` text and border on the badge surface | |
| Focus ring | `--info` | `#5aa9ff` |
| Locked chevron | opacity 0.55 (aria-disabled) | |
| Disabled | opacity 0.45 (native disabled, as today) | |

### 3.3 Contrast (WCAG 2.x, computed)

| Pair | Ratio | Result |
| --- | --- | --- |
| Continuous label `#062018` on `#3ee0b5` | 10.21:1 | AA (text) |
| Continuous label on `#2bc79e` (hover) | 7.96:1 | AA |
| Single label `#120a24` on `#a47cff` | 6.31:1 | AA |
| Single label on `#9166f5` (hover) | 4.95:1 | AA |
| CAPTURING badge `#a47cff` on `#121a26` | 5.75:1 | AA |
| Menu name `#dbe4f0` on `#182233` | 12.44:1 | AA |
| Menu description `#8a9ab1` on `#182233` | 5.58:1 | AA |
| Continuous icon `#3ee0b5` on `#182233` (menu) | 9.53:1 | AA (non-text 3:1 met) |
| Single icon `#a47cff` on `#182233` (menu) | 5.25:1 | met |
| Focus ring `#5aa9ff` on the toolbar surface `#121a26` | 7.12:1 | met (non-text 3:1) |
| Focus ring on the purple or teal fill | ~1.3–1.5:1 | **avoided**: see 3.4 |
| Locked chevron (0.55 opacity), disabled (0.45) | n/a | WCAG exempts inactive controls; the tooltip and the label still say what it is |

Hover is darker on the fill, and the ink stays the same, so the label contrast only falls at hover on
purple (4.95:1, still AA).

Note on `#a47cff` vs the existing SIMULATED badge (`--sim` `#c39bff`): both are violet. The fills are
solid and the badge is an outlined text tag, so they are distinguishable by shape, but see Q2.

### 3.4 Focus

- **One ring around the whole control**, not one per segment: `outline: 2px solid var(--info);
  outline-offset: 2px` on `.capture:has(:focus-visible)`, segments with no outline of their own.
  (`source.css` already uses `:has`, so no new technique.) A per-segment ring would sit on the
  neighbouring purple/teal fill at about 1.3:1 and disappear. Screenshot `crop-15-focus-ring-chevron-1024.png`.
- Focus stays on the button across start, pause and cancel (the element is not remounted), so keyboard
  users do not lose their place. A menu item keeps its own 2px ring (`outline-offset: -2px`).

## 4. Mode menu

```
┌──────────────────────────────────────┐   anchored to the chevron's right edge (right: 0),
│ CAPTURE MODE                         │   so it never leaves a 1024px window
│ ∿∿∿  Continuous                    ✓ │   role=menuitemradio aria-checked=true
│      Keeps acquiring until you pause.│
│ ⌇    Single                          │   role=menuitemradio aria-checked=false
│      Captures one sweep, then stops. │
│ ─────────────────────────────────── │
│ Changing the mode does not start a   │
│ capture.                             │
└──────────────────────────────────────┘
```

- Width 280px, `padding 6px`, `--surface-2`, `1px --border`, radius 8px, the same shadow as
  `.source-popover` (copy, not a new surface). Items use `.source-item` rhythm (7px/8px padding,
  6px radius, `--surface-3` on hover/focus).
- Icons are shape-coded: continuous = a repeated trace (many sweeps); single = one sweep then flat.
  The checkmark is shown only for the current mode (visibility, not colour).
- Opens by click, Enter/Space or ↓/↑ on the chevron (↓ and ↑ match the source button). Focus goes to
  the checked item.

## 5. States

Columns: state, backend status (`SessionStatus`), main button, accessible name, tooltip (native
`title`), chevron, plot badge, plot content, notice.

| # | State | Backend / UI model | Main button | Main aria-label | Main title | Chevron | Badge | Plot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Empty / no source** | `disconnected`, no source | native disabled, dimmed, ▶, mode label shown | Start continuous acquisition *(or Start single capture)* | Connect a source first | native disabled, title Connect a source first | `No source connected` | existing hint: "Choose a source to begin. Try Signal simulator." |
| 2 | **Connecting / disconnecting** | `connecting` / `disconnecting` | native disabled, dimmed, ▶ | as #1 | Connecting… / Disconnecting… | native disabled | existing liveness | existing |
| 3 | **Disabled, busy (starting)** | command in flight (`busy`) | aria-disabled (focusable, **not dimmed**, cursor progress), **icon stays ▶** until backend says `acquiring` | as current mode | Wait for the current change to finish *(chevron)* | aria-disabled, dimmed 0.55 | previous | previous |
| 4 | **Continuous, connected, idle** | `connected` | enabled, teal, ▶ | Start continuous acquisition | Start continuous acquisition | enabled: `Capture mode: Continuous`, title Choose capture mode | `Stopped` (no trace) / `HOLD · last data hh:mm:ss` | hint "No trace yet. Press Play to start continuous acquisition." / held trace (grey) |
| 5 | **Single, connected, idle** | `connected` | enabled, **purple**, ▶ | Start single capture | Start single capture: one sweep, then stop | enabled: `Capture mode: Single` | `Stopped` / `HOLD · last data hh:mm:ss` | hint "No trace yet. Press Play for one sweep." / held trace |
| 6 | **Continuous, acquiring** | `acquiring`, mode continuous | enabled, teal, ❚❚ | Pause continuous acquisition | Pause acquisition: the last trace stays on screen | aria-disabled, locked: title Pause or cancel acquisition to change the mode | `LIVE` (amber `Waiting for data…` before the first frame; existing `No data for N s` when stale) | live trace |
| 7 | **Single, capture in progress** | `acquiring`, mode single (backend reports it) | enabled, purple, **■** | Cancel single capture | Cancel capture: the previous trace stays on screen | locked (as #6) | `CAPTURING` (purple) | previous held trace stays until the new sweep; no trace yet: "Capturing one sweep…" |
| 8 | **Single, cancelling** | `acquiring` + stop in flight | aria-disabled, **■**, cursor progress | Cancel single capture | Cancel capture… | aria-disabled | `CAPTURING` | unchanged |
| 9 | **Single, auto-stopped** | backend moved to `connected`; the UI does not time it | enabled, purple, ▶ (back to #5) | Start single capture | as #5 | enabled | `HOLD · last data hh:mm:ss` (existing copy) | held trace, grey |
| 10 | **Continuous, paused** | `connected`, last frame held | as #4 | as #4 | as #4 | enabled | `HOLD · last data hh:mm:ss` | held trace, grey |
| 11 | **Mode menu open** | UI only | as the current state | as the current state | as the current state | `aria-expanded="true"` | unchanged | unchanged. Focus on the checked item. |
| 12 | **Error: capture failed** | `connected`, `lastNotice = acquisitionFailed` | enabled, purple/teal, idle icon (never stuck on ■) | as #5 or #4 | as #5 or #4 | enabled | `HOLD · last data …` or `Stopped` | notice bar (below) |
| 13 | **Device lost during capture** | `disconnected`, `lastNotice = deviceLost` | native disabled | as #1 | Connect a source first | native disabled | `No source connected` | existing notice (Reconnect) |
| 14 | **Long names** | any | unchanged width | unchanged | unchanged | unchanged | unchanged | source name truncates (ellipsis), full text in the source tooltip |
| 15 | **Simulator** | `connected` (simulated) | as #4/#5 | as #4/#5 | as #4/#5 | as #4/#5 | as #4/#5 + SIMULATED badge (unchanged) | simulated trace |

Notice for #12 (existing component, new copy from the backend):
`[Single capture failed: <backend message>]  [Restart]  [×]`. The message is the backend's (sample text in the
prototype: "Single capture failed: no sweep from SA430 08FF41E50F8B3A34."). The UI invents no
error copy. `Restart` runs the current mode.

Timing: the UI never assumes a transition. Icons and badges change on `SessionStatus` only. The
prototype delays for illustration (280 ms start, 2.6 s single sweep, 180 ms stop); these are not
latency targets.

### 5.1 Badge rules for single capture (change to `liveness.ts`, mode-aware)

- While single is capturing, the badge is `CAPTURING`, never `LIVE`. The sweep stops by itself, so
  "LIVE" would be a lie a moment later.
- The existing `No data for N s` (stale, amber) must not show during a single capture. A slow
  sweep is normal, not a stall. Only the continuous mode uses the stale rule.
- After the capture, the existing `HOLD` copy is reused. No new "single done" text.

## 6. Copy

| Element | Text |
| --- | --- |
| Main label (idle, acquiring, capturing) | `Continuous` / `Single` |
| Main aria-label | `Start continuous acquisition` · `Pause continuous acquisition` · `Start single capture` · `Cancel single capture` |
| Main tooltip | `Start continuous acquisition` · `Pause acquisition: the last trace stays on screen` · `Start single capture: one sweep, then stop` · `Cancel capture: the previous trace stays on screen` · `Connect a source first` |
| Chevron aria-label | `Capture mode: Continuous` / `Capture mode: Single` |
| Chevron tooltip | `Choose capture mode` · locked: `Pause or cancel acquisition to change the mode` · no source: `Connect a source first` · busy: `Wait for the current change to finish` |
| Menu heading | `CAPTURE MODE` (uppercase by CSS, the text is "Capture mode") |
| Menu item 1 | name `Continuous`, description `Keeps acquiring until you pause.` |
| Menu item 2 | name `Single`, description `Captures one sweep, then stops.` |
| Menu footnote | `Changing the mode does not start a capture.` |
| Plot badges | `LIVE` · `Waiting for data…` · `CAPTURING` · `HOLD · last data hh:mm:ss` · `Stopped` · `No source connected` (existing, except CAPTURING) |
| Empty hint | `Choose a source to begin. Try Signal simulator.` (existing) · `No trace yet. Press Play for one sweep.` · `No trace yet. Press Play to start continuous acquisition.` |
| Error notice | backend message + `Restart` |

Terminology: the label is `Single` (the story's wording and the common analyzer term), and prose says
"single capture". The story's "single shot" is not used in the UI.

Units: unchanged. Amplitudes stay `dBFS`; the status bar keeps `Unit dBFS` and `Uncalibrated`. A single
capture changes nothing about units or calibration.

## 7. Interaction

Keyboard, focus order (Tab): source button → **capture main** → **capture chevron** → Center → Span → side panel.

| Key | On the main button | On the chevron | In the menu |
| --- | --- | --- | --- |
| Enter / Space | start / pause / cancel (native button) | opens the menu, focus on the checked item | selects the item, closes, focus back on the chevron |
| ↓ / ↑ | nothing | opens the menu | move between items (wraps, as `useMenuKeys`) |
| Home / End | nothing | nothing | first / last item |
| Esc | nothing | nothing | closes, focus back on the chevron |
| Tab | normal | normal | closes the menu and moves on from the chevron (to Center), as `SourceMenu` does |
| Click outside | | | closes the menu (no mode change) |

- Locked or busy: `aria-disabled`, so the control keeps focus and the tooltip. A key press does
  nothing. (Native `disabled` only when there is no source, as today.)
- Mouse: click main = toggle; click chevron = open/close; click item = choose.
- No shortcut, no double-click behaviour, no drag.
- Tooltips: native `title`, as the rest of the toolbar. They are not keyboard reachable, so the
  accessible name carries the same information (no information only in the tooltip).
- Motion: no new animation. The existing `prefers-reduced-motion` rules stay. The capturing state is
  a colour/icon/badge, not a pulse.

## 8. Accessibility

- **Accessible names state mode and action.** `Start single capture` contains the visible label
  `Single` (WCAG 2.5.3 label-in-name). The same for all four names.
- **Group**: the control is `role="group" aria-label="Capture"`.
- **Chevron**: `aria-haspopup="menu"`, `aria-expanded`, name `Capture mode: <current>`.
- **Menu**: `role="menu"`, items `role="menuitemradio"` with `aria-checked`, `aria-labelledby` the name
  and `aria-describedby` the description.
- **Not colour-only**: the mode is in the label, in the chevron name and in the menu icon shape. The
  action is in the icon (▶ ❚❚ ■) and the name. The state is in the badge text. Purple vs teal is
  a redundant cue.
- **Announcements** (recommendation, Q6): a visually hidden polite live region announces only the
  end of a single capture ("Single capture complete"), its cancellation ("Single capture cancelled")
  and failures (the notice has `role="alert"`, as today). Continuous acquisition is not announced.
- **Contrast**: section 3.3. All text meets AA; hover on purple is 4.95:1.
- **Focus**: section 3.4.
- **Target size**: 30px tall (as today's controls); the chevron is 26px wide. Both meet a 24px minimum.
- **Reduced motion**: nothing new to disable.

## 9. Behaviour contract (for the PM and the staff engineer)

The UI shows backend state only. These are the rules the design depends on. The staff engineer owns
the detail and any ADR.

1. **Mode is a preference**, app-level (not per source). Default `continuous`. Persisted with the other
   display preferences. Validated in Rust on load (unknown value → `continuous`).
2. **The running mode comes back from the backend.** The UI must not infer "single in progress" from
   its own choice. Suggested field: `SessionStatus.acquisitionMode: 'continuous' | 'single' | null`
   (null when not acquiring). The UI keys the purple ■ and the CAPTURING badge off this field.
3. **Auto-stop** happens in the backend. It stops after one completed trace and reports the state
   change via `SessionStatus` (no UI timer). The trace is kept and reported as held.
4. **Cancel** stops the capture. A partly received sweep is discarded, not shown. The previous trace
   stays. Max-hold/min-hold are not reset by a cancel or a single capture.
5. **Averaging** (recommendation, Q4): a single capture completes when the trace on screen is complete,
   which means the averaging count is reached when averaging is on (the status bar's `Avg 4/4`). This
   matches the story's "one clean trace". Fallback if too costly: one raw frame, and the UI must then
   say so.
6. **No-sweep timeout**: the backend bounds the wait (value owned by the backend) and fails with
   `acquisitionFailed`. The UI never times out on its own.
7. **Mode change while acquiring** is rejected by the UI (locked chevron) and by the backend (returns an
   error if the mode is set while acquiring). Both sides, so a stale UI cannot change the mode mid-run.
8. **Restart** after `acquisitionFailed` runs the current mode.
9. **Bindings**: `SessionStatus` changes, so `npm run bindings` is needed and an ADR is likely
   (staff engineer).

## 10. Mapping: acceptance criteria to design

| AC (story.md) | Satisfied by |
| --- | --- |
| Split control: main label shows the mode + play/pause action; chevron on the right opens a mode menu | §3.1 wireframe, §4 menu, §5 states 4–7 |
| Colour by mode: purple single, existing accent continuous; WCAG AA in all states | §3.2 tokens, §3.3 ratios (all AA; disabled/locked exempt, labelled) |
| Continuous behaves like today's Play/Pause | §5 states 4, 6, 10. Only Pause's colour changes (Q1) |
| Single: one complete sweep, stops automatically, trace stays, button returns to idle; press again = new capture; cancel while in progress | §5 states 5, 7, 8, 9; §9 items 3–4 |
| Auto-stop by backend via `SessionStatus`, no UI timer, every source | §9 items 2–3; §5 note on timing; §5.1 |
| Default Continuous, remembered across restarts, validated in Rust | §9 item 1 |
| Mode changes while acquiring: selector disabled (default) | §4, §5 states 6–8 (chevron locked, tooltip), §9 item 7 |
| Disabled rules from 003 (no source, transitions), tooltips | §5 states 1–3, 13; §6 tooltips |
| Keyboard menu (arrows, Enter, Esc); accessible names state mode and action | §7 table, §8 |
| Visible focus ring | §3.4 (one ring on the whole control) |
| No layout shift between modes and states | §3.1 fixed 128px main + 26px chevron; icon swap inside fixed box; long names truncate (§5 #14) |
| Toolbar fits 1024px | §3.1 measured (no overflow for all scenarios), screenshots 10–13 |

## 11. Open questions (for the PM and the human)

- **Q1. Pause colour.** Recommendation: retire amber for Pause, so colour means mode only. Running is shown by
  ❚❚ + LIVE. Alternative: keep amber for Pause, which breaks the "colour = mode" rule. Human to confirm.
- **Q2. Purple vs SIMULATED.** The single purple `#a47cff` is close to the SIMULATED badge
  `#c39bff`. Shapes differ (solid button vs outlined tag). Alternative: a bluer violet, which would
  clash with the info blue focus ring. Recommendation: keep `#a47cff`; confirm on screenshot 13.
- **Q3. Choosing a mode while disconnected.** Recommendation: whole control disabled, as the story's
  disabled rule says. Alternative: let the chevron work with no source (it is only a preference).
- **Q4. Single and averaging.** Staff engineer to confirm "complete = averaging count reached".
  Story default was one frame per capture; I recommend the averaged trace, which the story's "one clean
  trace" implies.
- **Q5. Per-source or app-level mode.** Recommendation: app-level.
- **Q6. Live-region announcements** for single complete / cancelled. Recommendation: yes, only for
  single capture end, cancel and failure. Human/PM to confirm the scope.
- **Q7. Mode switch closes an open menu** when acquisition starts from elsewhere (for example the
  notice's Restart). Recommendation: the menu closes without changing the mode.
- **Q8. Real-font width check.** Prototype widths use the Ubuntu fallback in headless Chrome. QA must
  re-check the 1024px toolbar in WebKitGTK with `SA430 08FF41E50F8B3A34` and a 60-character name.

## 12. Prototype and screenshots

Prototype: `prototype/index.html` (one file, real tokens from `src/styles/app.css` and `source.css`).
Scenario buttons: Empty, Continuous idle, Continuous acquiring, Single idle, Single in progress,
Single auto-stopped, Menu open, Transition: stopping, Error, Long source name, Simulator. Width
buttons: 1440, 1180, 1024 (minimum). The page plays the backend with timers, so the source button
toggles connection, the buttons start and stop captures, and the menu is clickable and keyboard
operable. The source menu itself is not built (out of scope). Source names are mock values.

Screenshots (`prototype/screenshots/`, 1440 unless noted):

| File | State |
| --- | --- |
| `01-continuous-idle.png` | Continuous, connected, idle |
| `02-continuous-acquiring.png` | Continuous, acquiring (Pause, LIVE, chevron locked) |
| `03-single-idle-purple.png` | Single, idle (purple) |
| `04-single-capture-in-progress.png` | Single, capture in progress (■, CAPTURING) |
| `05-single-auto-stopped.png` | Single, auto-stopped (HOLD) |
| `06-menu-open.png` | Mode menu open |
| `07-disabled-no-source.png` | Disabled: no source |
| `08-disabled-busy-stopping.png` | Transition: command in flight (aria-disabled) |
| `09-error-capture-failed.png` | Error notice with Restart |
| `10-long-source-name-1024.png` | Long name at 1024 |
| `11-toolbar-1024-single-auto-stopped.png` | 1024 full window |
| `12-toolbar-1024-menu-open.png` | 1024 menu open |
| `13-toolbar-1024-simulator-single.png` | 1024 with SIMULATED |
| `crop-10`…`crop-13` | Toolbar strips at 1024 |
| `crop-14-focus-ring-main-1024.png`, `crop-15-focus-ring-chevron-1024.png` | Focus ring on the whole control |

Verification of the prototype: a jsdom run drove the flows (start, pause, menu with ↓ and Enter,
single auto-stop, cancel, Esc returning focus to the chevron, disconnect). No overflow at 1024.
