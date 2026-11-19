# 015 design: Always have a source selected; simulator fallback (#46)

Status: design note, for the PM and the human. No prototype: no new screen; the change is the start-up and disconnected states of the source button, popover, plot and Measurement. Normative text: `DESIGN.md` 5.2 (new 5.2.10), 5.8, 8.2, 8.5, 12 and 14 (draft 1.0-draft.5). Where this file and DESIGN.md differ, DESIGN.md wins.

Status words used below: **Approved** is the PM's approved decision (#46). **Proposed** is the designer's choice for the human to confirm. **Open** needs a human decision (listed in section 9).

## 1. User flow and entry points

- Launch, no device: the app connects the Signal simulator (connected, not acquiring). The user sees a plot hint and the source name. They press Continuous when they want data.
- Launch, device detected: the device is connected. The simulator is not.
- Device plugged in later: it replaces an idle simulator. It never interrupts acquisition.
- Disconnect: the source stays selected and disconnected. Pick its row (in the source popover) to connect again.
- Forget: a selected source that is not connected is forgotten and the selection falls back to the simulator.

## 2. Layout

No layout change. Start-up states of the existing source button and plot:

```
Start-up, backend answering (S0 Loading)
  [ Loading…                                  ▾ ]    secondary text, no dot, no attention outline
  Center [ —  ]  Span [ —  ]                          disabled, em dash
  [ Loading…                                    ]    capture control, unavailable

Launch, no device (S6 Connected, simulator)
  [ ● Signal simulator                         ▾ ]    teal dot, name
  plot: "No trace yet. Press Continuous to start acquisition."

Disconnected, selected (S13)
  [ ◌ Signal simulator                         ▾ ]    idle dot, name
  plot tag: No source connected
  plot hint: Not connected. Use the source button to connect.
```

The source name is truncated with an ellipsis (5.9); the full name is in the tooltip and the accessible name. A device name in the button (for example "SA430 08FF41E50F8B3A34", 22 characters) fits the 238px name area at 1024px (5.9, measured in 040).

## 3. Components

| UI element | Component | Status |
| --- | --- | --- |
| Source button in each state | `SourceButton` (existing); its name and state mapping in `status.tsx` | Feature change: the disconnected selected state maps to idle with the name kept; the loading state is added |
| Status dot | `StatusDot` (existing, `idle`, `connecting`, `connected`, `failed`) | Unchanged |
| Start-up copy "Loading…" | Text in `SourceButton` | Feature; no new component |
| Popover rows | `SourceMenu`, `ListRow`, `Popover` (existing) | The simulator row is always in the fixed block; the current row shows "Disconnected" when the selection is not connected |
| Failure banner (launch, lost device, status unavailable) | `NoticeBanner` (existing) | Unchanged. The launch failure uses the connect-failed banner |
| Plot hint and tag | `SpectrumView` hint, plot tag (existing) | Hint copy changes (section 7) |
| Status bar | `StatusBar` (existing) | Copy unchanged in S13 |
| Measurement rows | As 014 | See 014 section 6 |

New `src/ui` component: none. Reason: every element is an existing component in a new state. The only new pattern (a source that is always selected) is a state rule, not UI.

## 4. Start-up and the selected source (the rules)

| # | Rule | Status |
| --- | --- | --- |
| R1 | A source is always selected after start-up. The button never reads "Choose a source" after start-up. | Approved (#46) |
| R2 | Launch with a detected device: the device is selected and connected (Connecting… then Connected). The simulator is not connected. | Approved (#46) |
| R3 | Launch with no device: the Signal simulator is selected and connected, not acquiring. Nothing starts acquisition. | Approved (#46) |
| R4 | A device plugged in while a simulator is connected and idle replaces it: Connecting… for the device, then Connected. | Approved (#46) |
| R5 | A device plugged in while the simulator is acquiring does not interrupt. The device appears under Detected devices as New. | Approved (#46) |
| R6 | Any idle simulator (connected, not acquiring) is replaced by R4, whether R3 connected it or the user picked it. There is no "auto-started" flag. | Approved (human, design gate; overrides the designer's Q-28 recommendation) |
| R7 | Disconnect keeps the source selected (S13). | Approved (#46) |
| R8 | A detected device that fails at launch stays selected in Failed (S9). No simulator is connected in its place. | Proposed (Q-27) |
| R9 | A device that is lost stays selected in Not detected (S10). No simulator is connected in its place. A later "Added" event follows R4 only. | Proposed |
| R10 | Forgetting the selected source when it is not connected selects the Signal simulator, not connected. Forgetting the connected source keeps its name until another pick (as today, 5.2.8). | Proposed |
| R11 | The Signal simulator is always offered in the popover's fixed block, whatever has been used, and is not listed under Your sources. | Proposed (needs the staff engineer's check of stored entries) |
| R12 | Auto-connect never moves focus and never closes an open popover. Rows update in place. | Proposed |
| R13 | Auto-connect is not announced (it is not the user's action; 9.6). The button name and state are current when focused. | Proposed |
| R14 | Backend unavailable at start-up shows "Status unavailable" (S12), not "Choose a source". B3 is pulled into 015 (Q-30), so "Loading…" also ships. | Proposed (Q-30) |

R8 and R3 mean that a failed device at launch does not silently fall back. R8 is the designer's choice: the story says the simulator is the fallback "when no device is found", and a found device that fails is not "no device".

Consequence on the ADR: R4 replaces a connected source, and ADR 0014 says "never replace a source". ADR 0014 needs an amendment or a new ADR, written by the staff engineer, before implementation (not part of this design).

## 5. All states

Source button and selection:

| State | Button name and dot | Accessible name | Popover (current row line 2) | Plot tag and hint | Banner | Status bar |
| --- | --- | --- | --- | --- | --- | --- |
| S0 Loading (start-up) | "Loading…", secondary text, no dot, no attention outline | "Source: Loading…" | Popover not offered | Empty, no hint | None | Empty (as today) |
| S5 Connecting | Name, pulsing blue dot, "Connecting…" in the accessible name | "Source: <name>, Connecting…" | Current row "Connecting…"; rows locked | "Connecting…" tag (B8) | None | "Connecting…" (B8) |
| S6 Connected (simulator at launch, or a device) | Name, teal dot | "Source: <name>, Connected" | "Connected" | Hint: "No trace yet. Press Continuous to start acquisition." | None | "No data yet — press Continuous to start acquisition." |
| S7 Acquiring | Name, teal dot | "Source: <name>, Acquiring" | "Acquiring" | Live, waiting or stale (6.8) | None | As 6.8 |
| S9 Failed (launch or later) | Name, red cross | "Source: <name>, Failed" | "Failed" until the next pick | Hint: "Not connected. Use the source button to connect." | Connect-failed banner, polite: "Could not connect to <driver>: <reason>", Reconnect | As S13 |
| S10 Not detected (lost) | "Not detected", empty ring | "Source: <name>, Not detected" | "Not detected" | Last trace held (HOLD) | Warning banner, assertive: "<device> was unplugged." Reconnect when possible | As 5.2.7 |
| S12 Status unavailable (backend silent) | "Status unavailable" | "Source: Status unavailable" | Remembered list only if it loaded | Empty | Error banner, polite, with the reason | Empty |
| S13 Selected, not connected (new) | Name, idle dot | "Source: <name>, Disconnected" | Current row line 2 "Disconnected"; picking the row connects | Tag "No source connected"; hint "Not connected. Use the source button to connect." | None | "No source connected." |

Measurement and Source settings in each state: see 014 section 6. Source settings with no source: "Connect a source to see its settings."

Notes:

- S13 has no banner: the user disconnected on purpose; no success or failure message is needed (5.7).
- S13 shows no visible word on the button (the idle dot and the name only, as a remembered source does today). The plot tag and the status bar carry "No source connected" on screen. The popover row carries "Disconnected". Open: Q-31 (add a visible word to the button).
- Capture control in S0, S5, S8, S13: unavailable. Reason text: "Loading…" in S0, "Connecting…" or "Disconnecting…" in S5/S8, "Connect a source first" in S13 (existing copy in `CaptureControl`).

## 6. Popover (source selection)

- Groups as today: Your sources, Detected devices, then the fixed block (Signal simulator, Add source…, Disconnect).
- The Signal simulator row is always in the fixed block (R11). Remembered simulator entries are not listed under Your sources.
- Current row: `aria-current="true"` (as today). Its line 2 carries the state word from section 5: Connected, Acquiring, Connecting…, Failed, Not detected, or Disconnected (S13, new).
- Pick the current row while S13 to connect again. Pick any other row to switch (as today; Q-22).
- Keyboard and focus: as 5.1 and 4.11, unchanged. Auto-connect (R12) never moves focus.
- Empty states: no change. "Choose a source" never appears in the popover.

## 7. Copy (exact)

| Item | Text | Status |
| --- | --- | --- |
| Start-up, button | "Loading…" | Proposed (Q-30, B3) |
| Backend unavailable | "Status unavailable" with the reason in the banner: "Could not reach the backend: <reason>" | Proposed (B3). The reason wording is the backend's message |
| Selected, not connected: row line 2 | "Disconnected" | Proposed (S13) |
| Selected, not connected: plot tag | "No source connected" (existing) | Unchanged |
| Selected, not connected: plot hint | "Not connected. Use the source button to connect." | Proposed (S13) |
| Selected, not connected: status bar | "No source connected." (existing) | Unchanged |
| Source settings, no source | "Connect a source to see its settings." | Proposed (replaces "Choose a source to see its settings.") |
| Capture reason while loading | "Loading…" | Proposed |
| Old copy retired | "Choose a source", "Choose a source to begin. Try Signal simulator.", "Choose a source to see its settings." | Retired |

Units: none added. The simulator and the SA430 show their amplitudes as today (dBFS, dBm).

## 8. Keyboard, focus and screen readers

- No new shortcuts. Ctrl+K opens the source popover, as today.
- Launch: focus starts where the browser puts it (the document). The first status arrives while focus is wherever the user left it; no auto-focus is added.
- Auto-connect never moves focus (R12). If the focused control in Measurement disappears because the kind changes, 014 section 6 gives the next control.
- A name change of the source button is not announced (R13). It is current when focused and in the popover row name. This is a known gap for screen reader users at launch; QA checks it.
- Disconnect: focus stays on the Disconnect action in the popover (as today, the popover closes and focus returns to the source button, 5.1). No announcement beyond the state.
- Loading and status unavailable are visible text, not only colour.

## 9. Acceptance criteria mapping

| Acceptance criterion (#46) | Design element |
| --- | --- |
| No device at launch: simulator selected and connected, not acquiring | R1, R3; section 5 S6; plot hint "No trace yet…" |
| SA430 detected at launch: selected and connected, not the simulator | R2; S5 then S6 |
| Auto-started simulator connected and idle; SA430 plugged in: SA430 replaces it | R4; R6 (any idle simulator) |
| Simulator acquiring; SA430 plugged in: acquisition not interrupted | R5; the device appears as New in Detected devices (5.2.1 S4) |
| User disconnects: a source stays selected; never "Choose a source" after start-up | R1, R7; S13; R10 (forget); S1 retired |

## 10. Open questions and assumptions

- **Q-27, launch failure (R8).** Designer's recommendation: stay on the failed device with the banner and Reconnect; no silent fallback. Alternative: fall back to the simulator when a device fails to connect at launch. Human decides.
- **Q-28, decided (R6).** The human decided that any idle simulator is replaced, including one the user picked. The designer's recommendation (never replace a user's pick) was overridden.
- **Q-30, pull B3 into 015.** Recommendation: yes. Without "Loading…", the button shows "Choose a source" at start-up, which is the thing #46 removes. PM to confirm the scope change.
- **Q-31, visible word on the button in S13.** Recommendation: no word; the name and the idle dot, with "No source connected" in the plot and the status bar. Alternative: add "Disconnected" to the button name, which costs width in the 238px name area.
- **Staff engineer.** (a) ADR 0014 "never replace a source" needs an amendment for R4 and R6. (b) The selected source's kind while disconnected (014 section 4): reported by the backend, or the UI keeps the last report for the run. (c) The simulator in the fixed block (R11): confirm how remembered simulator entries are stored and listed. (d) R10: the selection after forget is a backend or UI rule; the designer has no preference. (e) The launch path must not change how acquisition starts (ADR 0014: auto-connect never starts acquisition).
- **Assumption.** No new IPC. The simulator is always available (it is part of the core), so the S1 "nothing chosen" state is not reachable; if a build ever lacks it, the staff engineer tells the designer and copy is designed then.
- **Assumption.** The status-to-copy mapping for the S13 state is the only change to `status.tsx`; the other mappings are as today.
- **Measured claims.** None are made in this file. The 238px name area and the 22-character device id are the existing measurements in 5.9. QA verifies the start-up layout at 1024, 1180 and 1440.
