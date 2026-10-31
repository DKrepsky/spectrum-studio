# Design 001: Simplify the source journey (revision 3)

Extends the current visual language (tokens `--surface*`, `--border`, `--accent`, `--warn`, `--danger`,
`--info`, `--sim`; `.toolbar`, `.state-pill`, `.badge`, `.field`, `NoticeBanner`, `ParamForm`). No new colours.
Sections marked **[REV2]** changed after Amendment 1; **[REV3]** marks the human's third review round (status circles,
fixed name/badge widths, one Add/Edit dialog replacing inline rename). Everything else is unchanged.

## How to review the prototype

Open `.claude/team/work/001-simplify-source-journey/prototype/index.html` in any browser (double click; no build,
no network). It is a simulation: no backend, nothing is real.

1. Pick a **Scenario** on the right (first launch, detected-not-remembered, remembered+present, remembered+absent,
   long names, connection failure, **edit while connected [REV3]**). Then click **Choose a source** (or press `Ctrl+K`).
2. Things worth clicking: pick a row (Connecting, then Connected or Failed); `✎` **Edit** (or `F2`) opens the Edit source
   dialog [REV3]; `×` forget then **Undo** (or `Delete`); **Add source…** and **Test connection** (`/dev/ttyACM0` succeeds,
   `/dev/ttyACM2` answers as a *different* SA430 (mismatch case), `/dev/ttyUSB9` fails, anything else times out);
   **Hardware simulation**: Unplug, Replug same port, Replug on `/dev/ttyACM1` (the edited row stays one row and keeps
   its name); **Window width** buttons (1024 is the real minimum, 520 is a stress case).
3. Screenshots of every scenario are in `prototype/screenshots/` (headless Chrome, same page; numbering in section 9).
4. Prototype-only: the right panel, simulated timings (900 ms connect), the Run button draws a fake trace.

## 1. Toolbar [REV2: widths]

```
▲ Spectrum Studio | [(green dot) SA430 08FF41E50F8B3A34 ▾] [▶ Run] (Connected) | Center [..] Span [..] | Export CSV
```

- ONE source control: the **source button** = status circle (same glyph set as the rows, section 2.0 [REV3]) + current
  source name + `▾`. With no active source there is no circle: just `Choose a source ▾`.
  Replaces Source select, Sources…, Connect, Disconnect, Switch.
- Order: source button, Run/Stop, state pill, SIMULATED badge.
- Disconnect lives only in the menu. Run is disabled while Connecting/Disconnecting and when there is no active
  source (title `Choose a source first`).
- Label: no active source `Choose a source`; otherwise the active source's name.
- **Width**: `min-width 150px`, `max-width 280px`, `flex: 0 1 auto` (may shrink, never grows beyond content).
  Name is one line with `text-overflow: ellipsis`. 280px leaves about 220px for the name = about 30 characters
  of Inter 13px: "SA430 08FF41E50F8B3A34" (22 chars, about 160px) is **never** truncated; 60 character names are.
  No badge and no status text on the button: the state pill is the status.
- Truncation is deliberate and recoverable: `title` shows the full name (and the shortcut); the menu row shows
  the same name with its own tooltip; the Edit dialog shows the entire name in an input.
- `aria-haspopup="menu"`, `aria-expanded`, accessible name `Source: <full name>, <state>` (never truncated for AT).
- `Ctrl+K` opens/closes the menu (tooltip `Choose source (Ctrl+K)`).
- The window minimum is 1024px, where the toolbar fits with the button at its full 280px (verified in prototype,
  screenshot 16). Below that (not supported) the popover clamps inside the window.

## 2. Source menu [REV2: rows, one row per device, Add source…]

Popover anchored under the source button. **Width 360px** (was 340; two-line rows), `min-width 280px`,
`max-width calc(100vw - 16px)`, left edge shifted left if it would overflow the window's right edge. Max height 70vh,
scrolls. Closes on Escape, outside click, or after a pick.

```
┌ YOUR SOURCES ─────────────────────────────────┐
│ (G) SA430 08FF41E50F8B3A34              [ USB ]│  <- active, connected
│     Connected · /dev/ttyACM0                   │
│ (g) Bench SA430                         [ USB ]│  <- remembered, present, not connected
│     /dev/ttyACM1                               │
│ (o) RTL-SDR Blog V4 0000000000000001 (…  [ USB ]│  <- remembered, absent (hollow circle)
│     Not detected · /dev/ttyUSB0                │
│ (g) Roof antenna north-facing, 2.4 GHz s… [ File ]│
│     /home/kr/captures/survey/roof-north-2g4-r… │
│ (g) Signal simulator                [Built-in] │
├ DETECTED DEVICES ──────────────────────────────┤
│ (g) SA430 08FF41E50F8B3A34              [ USB ]│  <- only devices NOT remembered
│     New · /dev/ttyACM0                         │
│   (or) No new devices found. Plug one in; this list updates automatically.
├────────────────────────────────────────────────┤
│ (g) Signal simulator                [Built-in] │  (until first used)
│     Open file…                                 │
│     Add source…                                │
├────────────────────────────────────────────────┤
│     Disconnect                                 │  (only when connected/acquiring/transitioning)
└────────────────────────────────────────────────┘
(G) green filled circle  (g) gray filled circle  (o) hollow gray circle  (x) red cross  see 2.0
```

### 2.0 Status glyph [REV3, replaces the `● ○ ◌ ⟳ ✕` text glyphs]

One 10px **circle** (CSS-drawn, centred in an 18px cell, identical on rows and on the source button). Colour comes from existing tokens only.

| State | Glyph | Token | Text next to it (always) |
| --- | --- | --- | --- |
| Connected / Acquiring | **filled GREEN circle** with a 2px soft halo | `--accent` (#3ee0b5, the app's green) | `Connected` / `Acquiring` (line 2, green) |
| Problem: last connect failed | **RED ✕** (bold, same 18px cell) | `--danger` | `Failed · <port>` (line 2, red) + NoticeBanner |
| Detected, usable, not connected (remembered+present; `New` detected; active-but-disconnected) | **filled GRAY circle** | `--text-muted` | `<port>` / `New · <port>` |
| Not detected (remembered but absent; device lost during a run) | **hollow GRAY circle** (2px ring, transparent fill) | `--text-muted` | `Not detected · <last port>` |
| Connecting / Disconnecting | the same circle, **filled BLUE, pulsing** (opacity 1 to .25, 1 s) | `--info` | `Connecting…` / `Disconnecting…` (blue) |
| Simulator, files, network entries (cannot be probed) | **filled GRAY circle** (they are always usable until a connect proves otherwise) | `--text-muted` | none (file shows its path) |
| No active source (button only) | no glyph | n/a | `Choose a source` |

- Shape carries meaning on its own where it matters: filled vs hollow vs cross. Green vs gray (both filled) is the one
  colour-only pair, so connected additionally has the halo ring, a thicker/larger look, and **always** the word
  `Connected` / `Acquiring` on line 2 and in the state pill; the source button's accessible name carries the state.
- A failed connect keeps the red ✕ until the next pick; a remembered file/simulator whose connect failed also shows ✕.
- Contrast (non-text, 3:1 against `--surface-2` #182233): `--accent` about 10:1, `--danger` about 6:1, `--info` about 6:1,
  `--text-muted` (#8a9ab1) about 5.5:1. Verified by eye in the screenshots; confirm numerically at implementation.
- `prefers-reduced-motion`: the connecting circle does not pulse; it is a static blue circle with a 2px ring, plus the text.
- Rule: an entry is gray-filled whenever the app has no evidence against it; only a *scan* (USB) or a *failed connect*
  moves it to hollow or ✕. Unprobed kinds never show hollow.

### 2.1 Row anatomy and fixed widths [REV3, fixes name/tag width]

A source row is a CSS grid **`18px | minmax(0,1fr) | 64px`**, min height 44px, padding 5px 8px, column gap 8px.
Inner usable width = 360 - 12 (popover padding) - 2 (border) - 16 (row padding) = about 330px.

- **Column 3 is a FIXED 64px** for *every* row, whatever the badge (`USB`, `File`, `Built-in`, none). The badge fills
  that column (`width: 64px`, text centred, never wraps, never shrinks; "Built-in" is the widest at about 56px).
  Consequence: the **name column is always 330 - 18 - 64 - 16 = about 232px (about 32 characters of Inter 13px)** on every
  row, in every state. "SA430 08FF41E50F8B3A34" (22 chars, about 160px) always fits; 60-char names always end at the same x.
  Rows with no badge (none today besides the fixed items) keep the empty column.
- **Line 1**: glyph (18px), **name** (one line, ellipsis at the end), **badge** (column 3).
- **Line 2** (column 2 only, 12px, `--text-muted`, **always rendered**, min height 17px, so every row has the same
  height and the actions have a place to live): `status text` + ` · ` + `detail`.
  - status text (`Connected`, `Acquiring`, `Connecting…`, `Not detected`, `Failed`, `New`) never shrinks or wraps;
    coloured `--accent` for Connected/Acquiring, `--info` for Connecting, `--danger` for Failed, otherwise muted.
  - detail = port for USB/serial, full path for files, empty for the simulator; mono 11px, ellipsis (first thing to
    truncate; full value in the tooltip).
- **Hover/focus actions (`✎` Edit, `×` Forget) live in the reserved column 3 on line 2** [REV3]: absolutely positioned in
  the 64px column under the badge (54px wide, two 26px buttons), `visibility: hidden` until hover, focus-within or
  keyboard selection. Showing or hiding them changes **no layout at all**: the name, badge and line-2 text do not move
  or resize, and they never overlap line 2 (which stops at column 2). A detected-not-remembered row has only `✎`
  (no `×`), right-aligned in the same slot.
- **Name rule**: shortened only by the ellipsis at the end of line 1; never wrapped, never cut by the badge, never
  overlapped by status text or actions.
- **Tooltip** (`title`) on every row: full name, driver, serial number, port or path, each on its own line.
- Verified (screenshots 05, 05b, 10, 15, 16): the 22-char name and the 60-char name, with and without hover actions,
  with USB / File / Built-in badges, truncate at the same x (the 60-char name ends exactly where the file row's name does).
  Same at the 1024 minimum and the 520 stress window.

### 2.2 One row per physical device [REV2, fixes problem 2]

**Identity**: a device row is identified by `driverId + deviceId` where `deviceId` is the device's stable id (SA430:
serial number, read from the device). The port is a *connection parameter*, never identity. Names, settings and
position belong to the remembered record; the port stored in it is refreshed from every scan/connect.

The menu is computed from two inputs, remembered records and the current scan, with a single rule:

> A device present in the scan whose `deviceId` matches a remembered record is shown **once, in Your sources**.
> Only devices that are detected and NOT remembered are shown in Detected devices.

Row states (glyph + text, never colour only):

| State | Section | Glyph (2.0) | Name | Line 2 | Selectable |
| --- | --- | --- | --- | --- | --- |
| Remembered + present | Your sources | gray filled circle | remembered name | `<port>` (current port) | yes |
| Remembered + absent | Your sources | hollow gray circle, name muted | remembered name | `Not detected · <last port>` | yes (backend reports failure) |
| Detected, not remembered | Detected devices | gray filled circle | default name `<device label> <serial>` | `New · <port>` | yes; remembered on first successful connect, or by Edit > Save |
| Active: connecting | wherever it belongs | blue pulsing circle | name | `Connecting…` + port | row `aria-checked` |
| Active: connected / acquiring | wherever it belongs | green filled circle | name | `Connected` / `Acquiring` + port | row `aria-checked` |
| Last connect failed | wherever it belongs | red ✕ | name | `Failed · <port>` | yes |
| Simulator, file | Your sources | gray filled circle | name | file path / none | yes |

- A device is never in both sections. Unplugging a remembered device moves nothing, it just becomes a hollow circle `Not detected`.
  Replugging on another port flips it back to a gray filled circle, with the new port on line 2 and the same name.
  Unplugging a detected-not-remembered device removes its row.
- Forgetting a present device removes it from Your sources and, after the Undo window, it shows again under
  Detected devices as `New` with the default name (it is still physically there). This is intended: Forget = "stop
  remembering", not "hide".
- **Detected devices** heading is always shown; empty text: `No new devices found. Plug one in; this list updates
  automatically.` (muted note, not an option). While scanning with an empty list: `⟳ Scanning for devices…`.

### 2.3 Editing an entry [REV3, replaces inline rename and "Naming a detected device"]

There is **no inline rename**. The row action `✎` (tooltip `Edit (F2)`, accessible name `Edit <name>`) and `F2` open the
**Edit source** dialog (section 4), the same dialog as `Add source…`. It applies to remembered rows and to detected
(not remembered) rows. Details in section 4.

### 2.4 Other rules (unchanged unless noted)

- **Your sources**: every remembered source, most recent first, never reordered while the menu is open. Max 6 rows
  visible (two-line rows), then the list scrolls inside the section. Includes the simulator after its first use,
  and then the fixed `Signal simulator` item disappears (no same-name pair). The fixed `Signal simulator` item uses the
  same 64px badge column and a gray filled circle.
- Fixed block: `Signal simulator` (until used), `Open file…`, **`Add source…`** [REV2, replaces "Other sources…"].
  `Add source…` is always visible when at least one available driver needs manual setup (today SA430); otherwise it is hidden.
- `Disconnect` separated at the bottom, only when connected/acquiring/transitioning (disabled while transitioning).
- Planned drivers are never listed anywhere.
- Scan runs while the menu is open (every 3 s), no Scan button, results refresh in place without flicker.
- Forget: immediate, row replaced in place by `Forgot "<name>". Undo` for 5 s (name truncates with ellipsis in the
  toast, full text in `title`); Undo restores with settings; forgetting the active source leaves the connection up.
  `Delete` key on a focused row = Forget. `F2` = Edit. `ArrowRight` focuses the row's action buttons, `ArrowLeft` back.
  Forget is also offered inside the Edit dialog (section 4.3).
- Keyboard/ARIA as before: `role="menu"`, `menuitemradio` + `aria-checked` for sources, groups with `aria-label`.

## 3. Choosing an entry (unchanged)

Pick = stop acquisition if running, release old source, connect new, close menu, button shows the new name with the
connecting glyph; the name only becomes "current" from backend `SessionStatus`. No confirmation.
`Open file…` uses the native dialog (type chosen by extension); remembered on success. Failures are not remembered
(already-remembered entries stay, marked `✕ Failed`), the backend message appears in the NoticeBanner
(`Connection failed: <message>`), state stays Disconnected.

## 4. Add / Edit source dialog [REV3: one dialog, two modes]

ONE component, two entry points: `Add source…` (title **Add source**, empty) and `✎` / `F2` on a row (title **Edit
source**, prefilled). Term decision: **"source"**, not "device": the menu, button and docs already say source, and the
dialog must also edit files and the simulator, which are not devices. Modal over the app (backdrop `rgba(5,8,14,.6)`),
width 440px, `max-width calc(100% - 24px)`, `--surface-2`, radius 8, popover shadow. `role="dialog" aria-modal="true"
aria-labelledby`. Focus trap; opens with focus in Name (text selected in Edit mode); Escape = Cancel; returns focus to the
source button.

```
┌ Edit source ────────────────────────────────────┐
│ Name                                            │
│ [Bench SA430                                  ] │
│ Driver                                          │
│ [SA430 spectrum analyzer              (locked)] │
│ The driver cannot be changed. To use another…   │
│ Serial port                                     │
│ [/dev/ttyACM0                                 ] │
│ Path of the device's serial port.               │
│ [Test connection] ┌ ✓ Connection OK. SA430 …  ┐ │
│                   │ Serial number 08FF… (matches this source)
│                   └───────────────────────────┘ │
│ (notes: mismatch / new device / connected lock) │
│ [Forget]                        [Cancel] [Save] │
└─────────────────────────────────────────────────┘
```

### 4.1 Fields

- `Name`: required, 1-60 chars (trimmed), unique case-insensitively among remembered sources **excluding the entry being
  edited** (error `A source with this name already exists.`). Placeholder `e.g. Bench SA430`. Add mode only: if blank when
  a test succeeds it is pre-filled with `<device label> <serial>` (suggestion; never overwrites typed text). A blank name
  is an error (`Enter a name.`); there is no "blank restores default" any more.
- `Driver`:
  - **Add**: `<select>` of drivers with `status === 'available'` that are not auto-discovered and not file drivers
    (today only `SA430 spectrum analyzer`; still shown so the pattern holds). Helper: `Only sources that need manual
    setup are listed. USB devices that are detected automatically do not need this.`
  - **Edit**: the same `<select>` showing the entry's driver, **disabled** (locked, 75% opacity so it stays readable),
    helper `The driver cannot be changed. To use another, forget this source and add a new one.`
- **Parameters** come from the driver's `connectionParams` ParamSpec via `ParamForm` (no device knowledge in the dialog),
  prefilled from the entry:
  - **SA430**: `Serial port` (text, required, `/dev/ttyACM0`), help `Path of the device's serial port.`, plus Test connection.
  - **File entries**: one read-only mono field `File` showing the full path (tooltip = path), helper `The file cannot be
    changed. To use another file, choose Open file….` No Test connection (nothing to probe). Only Name is editable.
  - **Simulator**: no fields beyond Name and Driver (`Signal simulator (built-in)`); note `The simulator has no settings;
    only its name can be changed.` No Test connection.
  - Any future driver's connection params appear here automatically, editable; its "Test" appears only if the driver can probe.
- **Test connection**: unchanged from REV2 (separate probe, result box with reserved space, `role="status"`/`"alert"`,
  idle/running/ok/fail texts, editing a parameter resets it to idle, never disturbs the active session; a port held by
  the active source returns `<port> is in use by the active source. Stop and disconnect it first.`).

### 4.2 Identity re-resolves on test / save (entries identified by serial) [REV3]

An SA430 entry is identified by its serial (`deviceId`); the port is only a connection parameter (section 2.2).
When the user changes the port and runs **Test connection**:

| Test result | Result box | Save |
| --- | --- | --- |
| Same serial as the entry | `✓ Connection OK. SA430 spectrum analyzer found.` + `Serial number <serial> (matches this source)` | enabled; port updated |
| Different serial, not remembered elsewhere (**mismatch**) | success box + amber note `⚠ Different device: serial <new>, this source is <old>. Saving binds this source to serial <new>; its name and settings are kept.` | **enabled**; on Save the entry's `deviceId` becomes the new serial and its port the new port (e.g. the user replaced a broken SA430). Never silent: the note is shown before Save and `role="alert"`. |
| Serial belongs to **another** remembered source | success box + `⚠ This device is already in Your sources as "<name>".` | **disabled** (no same-device duplicates) |
| Fails | `✕ Test failed: <backend message>` + `You can still save an untested source.` | enabled (hardware may be offline) |
| Not tested | idle box | enabled; **port updated, identity (old serial) kept**. On the next connect the backend reads the serial; if it differs from the entry's, the connect fails with `Connection failed: <message>` (backend wording: expected serial vs found) and the row shows `✕ Failed`; the user re-opens Edit and tests to re-bind. |

An entry without a serial yet (saved untested earlier) gets its serial from a successful test or first connect (as in REV2).

### 4.3 Buttons, Forget, Save, Cancel

- Left: **`Forget`** (danger-outlined text button, Edit mode on a *remembered* entry only). Decision: **Forget lives in both
  places**: `×` on the row (fast path) and `Forget` in the dialog (discoverable). Pressing it closes the dialog without
  asking and behaves exactly like the row `×`: menu re-opens, the row is replaced by `Forgot "<name>". Undo` for 5 s;
  forgetting the active source leaves the connection up. Not shown for detected-not-remembered entries or in Add mode.
- Right: `Cancel`, `Save` (primary). Save is enabled only with a valid name and valid parameters and no duplicate-device
  error. A test is never required. Enter in a text field = Save when enabled; Escape/Cancel discard everything, no confirmation.
- **After Save** (Add or Edit): dialog closes; the menu re-opens with that row focused and a 3 s accent highlight;
  **nothing connects**, the toolbar/pill/running session are unchanged (Enter on the row connects).
- Closing the dialog while a test runs discards the probe result.

### 4.4 Edit behaviour per entry kind [REV3]

| Entry | Dialog contents | Save does |
| --- | --- | --- |
| Remembered SA430 (present or absent) | Name, Driver (locked), Serial port, Test | updates name/port/identity per 4.2; row keeps its place and identity |
| **Detected, not remembered** SA430 | Name prefilled with the default `SA430 <serial>`, port = current port, Test; info note `New device, not remembered yet. Save remembers it; it does not connect.`; **no Forget button** | **remembers it** under the entered name keyed by its serial, without connecting; the row moves to the top of Your sources, highlighted. (Even an unchanged Save remembers it.) |
| Simulator | Name, Driver `Signal simulator (built-in)` locked, no params | renames only |
| File | Name, Driver `Recording file` locked, read-only `File` path | renames only |
| Any entry, **while it is the active source and Connecting / Connected / Acquiring** | Name editable; **connection parameters locked** (disabled, helper `In use by the active connection. Disconnect to change the port.`); Test hidden; info note `This source is connected. The name changes now; connection settings are locked until you disconnect.` | **name applies immediately** (toolbar button and rows update, session untouched); params cannot change, so no reconnect is ever needed. Forget stays available (connection stays up). When disconnected, the active entry is edited like any other. |

Decision rationale: locking is simpler and safer than "applies on next connect" (no row showing a port the live session
is not using) or auto-reconnect (surprising interruption of an acquisition).

### 4.5 F2 and keyboard

`F2` on a focused row (remembered or detected) opens Edit; inline rename and its hint text no longer exist. `Delete` still
forgets. Dialog Tab order: Name, Driver (skipped when locked), Serial port (skipped when locked/read-only), Test connection,
Forget, Cancel, Save; focus trapped.

## 5. States [REV3 glyphs, edit rows]

"Circle" = section 2.0. Every state also has text (button accessible name, pill, row line 2).

| State | Source button | Menu / other UI |
| --- | --- | --- |
| First launch | `Choose a source` (no circle), one-time accent outline; Run disabled | Fixed block (`Signal simulator` with gray circle, `Open file…`, `Add source…`) plus Detected devices. Plot hint: `Choose a source to begin. Try Signal simulator.` |
| Nothing remembered, nothing detected | as above | Your sources omitted; Detected devices note `No new devices found. Plug one in; this list updates automatically.` |
| Scanning, list empty | unchanged | `⟳ Scanning for devices…` in Detected devices (text spinner, not a status circle); results update in place. Scan failure: muted `Could not scan for devices: <message>` |
| Detected, not remembered | n/a | gray filled circle, `New · <port>`; `✎` only |
| Remembered, present, not connected | n/a | gray filled circle, `<port>` |
| Connecting | name + **blue pulsing circle** | Pill `Connecting…`; Run disabled; menu entries `aria-disabled`; row `Connecting…` in blue |
| Connected / Acquiring | name + **green filled circle** | Pill; row `Connected`/`Acquiring` in green; Disconnect enabled; picking another source stops first, no prompt |
| Disconnecting | name + blue pulsing circle | entries disabled |
| Disconnected after Disconnect | name kept, **gray filled circle** | Run reconnects the active source |
| Connection failed | attempted name + **red ✕**, pill Disconnected | NoticeBanner with the backend message; row `✕ Failed · <port>` in red; cleared on next pick |
| Device unplugged during run | name + **hollow gray circle**, pill Disconnected | NoticeBanner `deviceLost` with **Reconnect**; row hollow circle `Not detected` (same row, same name) |
| Remembered device absent | n/a | **hollow gray circle**, `Not detected · <last port>`, name in muted colour, selectable |
| Simulator / file entry | circle gray filled when selected-and-idle; green when connected | gray filled in the menu (cannot be probed); green only while connected; red ✕ if their connect failed |
| Saved source with unavailable/unknown driver | n/a | Not listed; kept in `sources.json` untouched |
| Add / Edit: invalid | n/a | Save disabled, errors under touched fields |
| Add / Edit: testing / OK / failed / mismatch / duplicate | active session untouched | sections 4.1, 4.2 |
| Edit: active source connected | unchanged (name updates on Save) | connection params locked, section 4.4 |
| Add / Edit: saved | unchanged | menu re-opens, row highlighted, nothing connected |
| Forget from dialog | unchanged | menu re-opens with `Forgot "<name>". Undo` |

## 6. Keyboard and accessibility

- Source button: Enter/Space/ArrowDown opens the menu, focus goes to the active source row, else the first item.
  Up/Down/Home/End, Enter activates, Esc closes, Tab closes and moves on. `F2` Edit, `Delete` Forget, Right/Left
  into and out of the row actions, `Ctrl+K` toggles the menu.
- Dialog: Tab order Name, Driver, Serial port, Test connection, Forget (Edit only), Cancel, Save; locked fields are skipped; focus trapped; Esc cancels; Enter saves.
  Errors are associated with fields (`aria-invalid`, text below); test results use `role="status"` (running/ok) and
  `role="alert"` (failure).
- Not colour only [REV3]: filled vs hollow circle vs ✕ shapes, the green halo, plus status text (`Connected`, `Not detected`, `Failed`...)
  and the state pill; the glyphs are `aria-hidden` and the same information is in the row text and the button's accessible name; test result has `✓` / `✕` and text.
- Contrast: text and badges >= 4.5:1 on `--surface-2`; dimmed absent rows use `--text-muted` (verify at implementation;
  the 0.45 opacity on disabled entries is an existing pattern, but "Not detected" rows are NOT opacity-dimmed, only
  their name colour is muted, so the status text stays legible).
- Hit targets: rows 44px (single 30px), action buttons 26px wide x 24px high (two fit in the 54px reserved slot).
- Locked fields in Edit use `disabled` at 75% opacity (existing disabled pattern is 50%; raised so the value stays readable, still >= 4.5:1 for the value text).
- `prefers-reduced-motion`: the connecting circle and the text spinner (`…`) do not animate; the highlight fade becomes an instant 3 s outline.

## 7. Removed from existing UI (unchanged, plus)

`SourceSelector`, `SourceManager`, Sources dialog, Connect/Switch buttons, "Save setup…", "Save configuration…",
selected-vs-connected state, Planned tag, Scan button, **inline rename (input, hint, blank-restores-default)** [REV3], **the "Other sources…" menu item and inline details form view
for manual drivers** [REV2] (the inline form view can remain for a *detected* device or file that needs a missing
required parameter, e.g. raw IQ sample rate; that is unchanged).

## 8. Copy (exact)

- `Choose a source`, `Choose source (Ctrl+K)`, `Choose a source first`.
- Headings: `Your sources`, `Detected devices`.
- Fixed items: `Signal simulator`, `Open file…`, `Add source…`, `Disconnect`.
- Row texts: `Connected`, `Acquiring`, `Connecting…`, `Not detected`, `Failed`, `New`.
- Empty/scanning: `No new devices found. Plug one in; this list updates automatically.`, `Scanning for devices…`.
- Toast: `Forgot "<name>".` + `Undo`. (Rename hint removed.)
- Row actions: `Edit (F2)`, `Forget (Delete)`; accessible names `Edit <name>`, `Forget <name>`.
- Dialog titles: `Add source`, `Edit source`. Buttons: `Forget`, `Cancel`, `Save`, `Test connection`. Labels: `Name`, `Driver`, `File`, `Serial port` (from ParamSpec).
  Edit-only: `The driver cannot be changed. To use another, forget this source and add a new one.`,
  `The file cannot be changed. To use another file, choose Open file….`, `The simulator has no settings; only its name can be changed.`,
  `New device, not remembered yet. Save remembers it; it does not connect.`,
  `This source is connected. The name changes now; connection settings are locked until you disconnect.`,
  `In use by the active connection. Disconnect to change the port.`, `Serial number <serial> (matches this source)`,
  `Different device: serial <new>, this source is <old>. Saving binds this source to serial <new>; its name and settings are kept.`
- Dialog (shared): `Name`, `Driver`, `Serial port` (from ParamSpec), `Test connection`, `Save`, `Cancel`,
  `Testing connection…`, `Connection OK. <driver name> found.`, `Serial number <serial>`,
  `Test failed: <backend message>`, `You can still save an untested source.`, `Enter a name.`,
  `At most 60 characters.`, `A source with this name already exists.`, `This device is already in Your sources as "<name>".`,
  `Use a device path such as /dev/ttyACM0.` (hint text comes from ParamSpec validation).
- Failure banner: `Connection failed: <backend message>`.
- No amplitude, dBm or dBFS appears in these surfaces; nothing implies calibration.

## 9. Acceptance criteria mapping

| Criterion | Design element |
| --- | --- |
| One control, no Connect/Switch/Sources… | 1, 7 |
| Plugged device listed without Scan | 2.2 Detected devices, background scan |
| Pick another source stops, connects, shows name | 3 |
| Open file…, type chosen automatically | 3 |
| Auto-remembered, reconnects with settings | 2.4, 3 |
| Forget removes it | 2.4 Forget + Undo |
| Failure shows backend message, stays Disconnected | 3, 5 |
| Planned drivers not anywhere | 2.4, 4 Driver select |
| sources.json entries appear | 2 (migration is backend) |
| Run/Disconnect | 1, 5 |
| "Add source…" with Name, Driver (SA430), serial port, Test connection, Save, Cancel | 4 |
| Test result shows success/backend message, session undisturbed; Save only with valid name and params | 4 Test connection, Save |
| Saved source appears in Your sources and connects when picked | 4 After Save, 3 |
| Detected AND remembered = exactly one row, no same-name pairs | 2.2 |
| Edited name survives unplug/replug (same or other port), one row | 2.2 identity table, 4.2, prototype Replug scenarios |
| Status circle per state (green / red ✕ / gray / hollow), text alongside [REV3] | 2.0, 5 |
| Name width constant regardless of badge or hover actions [REV3] | 2.1 (64px badge column, reserved actions slot), screenshots 05, 05b, 10, 15, 16 |
| ✎ opens the Add dialog titled Edit source, prefilled, Test/Save/Cancel [REV3] | 4, 4.4, screenshots 12, 17-21, 23 |
| Long name shown cleanly, truncation deliberate with full name available, screenshots | 1, 2.1, screenshots 05, 05b, 10, 15, 16 |
| Docs and tests | user guide rewrite; test ids below |

Suggested test ids: `source-button`, `source-entry`, `source-disconnect`, `source-add`, `add-source-dialog`,
`add-source-name`, `add-source-driver`, `add-source-test`, `add-source-test-result`, `add-source-save`, `add-source-cancel`;
Edit [REV3]: `source-edit` (row action), `edit-source-forget` (dialog), the dialog reuses the `add-source-*` ids and the title is `Edit source`.

## 10. Open questions for the staff engineer (assumptions stated)

1. **Stable device identity**: assume the SA430 driver can read a serial number from the device, and `DeviceDescriptor`
   gets a stable `deviceId` (serial) separate from the connection (`port`). Remembered records store `deviceId` plus
   the last connection params; matching key is `driverId + deviceId`. Does the current driver derive the id from the port?
2. **Records without a serial**: a source saved from Add source… without a successful test has no `deviceId`.
   Assumption: backend fills `deviceId` on first successful connect and, if a record with that serial already exists,
   merges (keep the older name) instead of creating a duplicate. Alternative: require a successful test to save (rejected:
   hardware may be offline).
3. **Test connection command**: a `testConnection(driverId, connection)` IPC that opens the device, reads identity and
   closes, returning `{ ok, deviceId?, label?, message }`, independent of the session (must not touch the active
   source; if the port is held by the active source it returns an error message, no blocking). Timeout about 2 s,
   cancellable.
4. **Present/absent**: scan results carry `deviceId` and current port; the UI never trusts the stored port for presence.
5. **Remembering a detected device by Edit > Save**: needs an upsert command (create record without connecting).
   [REV3] **Edit** also needs: update name / connection params / `deviceId` of an existing record by id (name uniqueness
   excluding itself, validated in Rust); `testConnection` must work for an existing record's port and return the serial so the
   UI can compare it with the record (`ok` + `deviceId`); re-binding a record to a new serial on Save when the test saw a
   different one (reject if another record already has that serial). **Question**: when an *untested* port edit is saved and
   the connect later reads a different serial, assume the backend fails the connect with a clear message (expected vs found
   serial) rather than silently using the other device. No new command is needed for locking params while connected: the UI
   derives it from `SessionStatus` + active source id.
6. Unchanged earlier assumptions: connect-on-pick is one atomic backend command; unknown-driver records stay on disk;
   `lastUsedMs` ordering; `Ctrl+K` free in the shell.

## 11. Assumptions / for human review

- Edit > Save on a detected device remembers it immediately (without connecting). [REV3, was rename]
- Forgetting a physically present device makes it reappear under Detected devices as `New` after the Undo window.
- Save in Add source is allowed without a passing test (hardware may be offline); duplicates by serial and by name are blocked.
- After Save the menu re-opens with the new row highlighted; nothing connects.
- Popover widened to 360px and rows are two-line; the name column is a constant about 232px (about 32 characters) because the badge column is fixed at 64px; 22-character serial names fit. [REV3]
- Status circles: green = connected, red ✕ = failed, gray filled = usable but not connected (including simulator/files), hollow = not detected, blue pulse = connecting. Green (`--accent`) is the app's existing mint accent. [REV3]
- The dialog is called **Edit source** (not Edit device) because it also edits files and the simulator. Forget exists on the row (`×`) and in the dialog. Changing the port of a serial-identified entry and testing a different device offers to re-bind it (explicit amber note); untested saves keep the old serial. Connection parameters of the connected source are locked until disconnect (the name stays editable). [REV3]
- The source button never shows a badge or status text; the pill is the status.
