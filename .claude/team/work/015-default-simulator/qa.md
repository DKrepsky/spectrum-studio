# QA: 014 measurement param rows (#45) and 015 default simulator (#46), no-device run

Tester: qa. Date: 2026-11-19. Tree: uncommitted working tree on `feat/40-measurement-source-capture`.
Hardware: SA430 unplugged (no `/dev/ttyACM*`), so every "SA430 attached" check is NOT RUN.
Raw evidence (gitignored): `.claude/team/work/015-default-simulator/evidence/`. Curated screenshots: `.claude/team/work/015-default-simulator/screenshots/`.

## Verdict: FIX FIRST

Functionally the no-device behaviour of #46 and the simulator rows of #45 work in the real app. Do not commit until:

1. **BUG-QA-1 (blocker for commit):** `e2e/specs/migration-dup.e2e.ts` "wrote version 3 with one record" fails. Root cause is a stale test expectation, not a migration defect (see Findings). Fix the spec, then re-run the full e2e.
2. **FIND-QA-2 (decide before commit):** after Disconnect with a trace on screen, the plot shows no "No source connected" tag and no "Not connected..." hint (design S13). Designer/PM decision needed.

The SA430-attached checks (below) remain open and must run before the hardware-dependent part of #45 and #46 is called done.

## Command results

| Gate | Command | Result | Evidence |
| --- | --- | --- | --- |
| Full check | `npm run check` | exit 0. cargo fmt, clippy -D warnings, cargo test (14 test binaries, 250 passed, 0 failed), Prettier, ESLint, tsc (app and e2e), Vitest 58 files / 803 tests passed | `evidence/check.log` |
| Full e2e | `npm run e2e` (debug build, WebKitWebDriver from a scratch extraction) | exit 1. 111 passed, 1 failed (migration-dup), SA430-gated tests skipped. `startup` (4), `acquisition` (21, incl. the two no-device launch tests that are pending when an analyzer is attached) ran for real | `evidence/e2e-full.log`, cleaned copy in the scratchpad |
| Visual guard, rerun x2 | `wdio run --spec visual.e2e.ts` | 47 passing, 0 failing in both reruns. The hover "did not settle" failure did not reproduce in any of the 3 visual runs | `evidence/visual-rerun-1.log`, `evidence/visual-rerun-2.log` |
| Probes 1-3 (temporary specs, removed from `e2e/specs/`) | `wdio run --spec qa-015-probe*.e2e.ts` | 6 + 4 + 1 passing; the probe checks are listed below | `evidence/probe/` (specs kept in `evidence/probe/specs/`) |

## Acceptance criteria #46 (default simulator)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 46.1 | No device at launch: simulator selected and connected, not acquiring | **PASS** | e2e `startup` test 1 and `acquisition` test 1 ran (not pending). Probe 1: button "Source: Signal simulator, Connected", state Connected, liveness `stopped`, acquire button `idle`, hint "No trace yet. Press Continuous to start acquisition." `screenshots/launch-1024-simulator.png` |
| 46.2 | SA430 at launch: selected and connected, not the simulator | **NOT RUN (hardware)**. Rust unit tests cover the rule (`autoconnect` tests, incl. first discovered device wins). | `sa430.e2e.ts` first test (env-gated) |
| 46.3 | Idle simulator (connected, not acquiring) is replaced when an SA430 is plugged in | **NOT RUN (hardware)**. Core test "Added while the simulator is idle" passes (launch-connected and manual pick). | Plug-in step, `sa430.e2e.ts` header (manual) |
| 46.4 | SA430 detected at launch but fails: stays selected, Failed, no fallback | **NOT RUN (hardware)**. Core test passes; the busy-port e2e (`/dev/ttyACM0` held with TIOCEXCL) is env-gated and was not run. | `sa430.e2e.ts` busy-port test |
| 46.5 | "Loading…" before the backend answers (closes #3) | **PASS** | Probe 2, MutationObserver on the button label across `reloadSession`: `["Source: Loading…", "Source: Signal simulator, Connected"]`; "Choose a source" never recorded. `startup` test 2 passes. `screenshots/startup-1024-after-restart.png` (final state) |
| 46.6 | Simulator acquiring, SA430 plugged in: acquisition not interrupted | **NOT RUN (hardware)**. Core test passes. | Plug-in during capture, `sa430.e2e.ts` header (manual) |
| 46.7 | Disconnect keeps a source selected; button never "Choose a source" after start-up | **PASS** | Probe 1 after Disconnect: "Source: Signal simulator, Disconnected" (name kept, idle dot). `disconnected-1024/1180/1440-simulator.png`. `acquisition` "disconnect keeps the selection" passes. `startup` test 4 passes. |
| 46.x | Forget the selected, not connected source: simulator is selected (R10) | **PASS** (e2e) | `add-source` "forgetting the selected, not connected source..." passes: "Source: Signal simulator, Disconnected". |
| 46.x | Source menu fixed simulator row (R11) | **PASS** | Probe 2 and `menu-disconnected-1024-simulator.png`: one "Signal simulator / Built-in / Disconnected" row in the fixed block, no unnamed duplicate under "Your sources". Connected menu: "Acquiring", `aria-current="true"` (probe 2). |

## Acceptance criteria #45 (Measurement rows)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 45.1 | Connected SA430: rows Center, Span, Freq. step, Reference level, Averaging; source button first, hold row and capture last | **NOT RUN (hardware)** for the real device. Code order is verified (`MeasurementPanel.tsx`: measurement params after Span, before Averaging). The injected-row probe (a fake, see method) shows Frequency step and Reference level between Span and FFT size with the real CSS. | Probe 2 `injected-sa430-shaped-rows-1024/1440-simulator-fake.png` |
| 45.2 | Connected SA430: Frequency step and Reference level not in Source settings | **NOT RUN (hardware)**. Simulator Source settings contain no SA430 rows (probe 2 text). `SourcePanel` filters `placement === 'source'`; `sa430.e2e` first test asserts it (env-gated). | Probe 2 `sourceSettingsText` |
| 45.3 | Simulator: rows Center, Span, FFT size, Window, Averaging; no Freq. step / Reference level | **PASS** | Probe 1 row list, connected (acquiring; idle has the same structure) and disconnected: Center, Span, FFT size, Window, Averaging, hold row, capture. No Frequency step or Reference level in the DOM. `connected-1024/1180/1440-simulator.png` |
| 45.4 | Any source: a setting it does not use is hidden, not disabled | **PASS (simulator)** | Frequency step and Reference level are absent from the DOM for the simulator (not disabled). FFT size and Window are used by the simulator, so they stay (disabled with reason while disconnected). The SA430 half is NOT RUN (hardware). |
| 45.5 | Changing Freq. step / Reference level in Measurement applies as in Source settings | **NOT RUN (hardware)**. Vitest covers the `applySettings({params})` path (MeasurementPanel tests "sends a typed Frequency step...", "sends a picked Reference level..."). `sa430.e2e` "shows Frequency step and Reference level in Measurement..." is env-gated. | - |
| 45.6 | Keyboard order = visual order; screen readers announce label and unit | **PASS for the simulator rows; SA430 rows NOT RUN.** Tab order from the source button (probe 2 `tabOrderConnected`): Center, Span, FFT size, Window, Averaging, Max hold, Min hold, Reset, Continuous, capture chevron, Markers. Accessible names: Center "Center frequency", Span, FFT size, Window, Averaging "Averaging" with description "traces". | Probe 1 `tabOrderConnected` and `rowsConnected` in `evidence/probe/probe.json` |

Measured: the label column is 165 px with a 90 px NumberField control and 157 px with a 140 px Select (probe 1 and 2, `clientWidth`). "Frequency step" and "Reference level" fit in those columns with 8 px before the control (probe 2 `inject1024/1180/1440`: `scrollWidth == clientWidth`, no overflow, text ends well before the control). Screenshot check: `injected-sa430-shaped-rows-1024-simulator-fake.png` is OK. The unit of the injected Frequency step row reads "traces" because the fake cloned the Averaging row; that is a probe artifact, not product.

## Other checks in this run

| Check | Status | Evidence |
| --- | --- | --- |
| Commit keeps focus (Averaging, Enter) | **PASS** | Probe 1: focus stays on `averaging` after Enter, value committed (`Avg 7/7` in the status bar). `averaging-committed-1024-simulator.png` |
| Keyboard focus is visible on Measurement rows | **PASS** | Probe 3: Tab from the source button lands on Center (`:focus-visible` true, 2 px `rgb(90,169,255)` outline) and Span (focus-visible true). `focus-span-1024-simulator.png`; the Center shot is in `evidence/probe/`. |
| Visual 1024 / 1180 / 1440 (connected, disconnected) | **OK** | Screenshots reviewed (see table below). |
| 200% zoom (simulated by root CSS zoom, see webview-zoom memory) at 1024 and 1180 | **OK, simulated** | `connected-1024-zoom200-simulator.png`, `connected-1180-zoom200-simulator.png`: rows readable, no clipping, panel and rows `scrollWidth == clientWidth`. Simulated by zoom; media queries are not re-evaluated. |
| Disabled state while disconnected | **PASS** | Center and Span show an em dash and are disabled; FFT size and Window disabled with "Connect a source first" as the accessible description; capture disabled. |
| Unit labelling | **OK** | IQ amplitudes are labelled dBFS in the plot, the status bar says "Unit dBFS / Uncalibrated". No dBm on the simulator (correct). |
| "Loading…", "Status unavailable" (S12), Source settings copy | Loading: PASS (probe 2). Status unavailable: NOT RUN in the app (needs a silent backend); Vitest covers it. Source settings "Connect a source to see its settings.": not seen (the simulator has settings); not run. |
| Long strings (60 chars) | Covered by the visual guard `Very long source name (60 chars)` (passes in the 47-test run). Not re-captured for this change. |

### Screenshot review

Each screenshot was opened and read.

| File | Finding |
| --- | --- |
| `launch-1024-simulator.png` | ok. Simulator connected, Stopped, hint, Measurement rows correct, status bar "No data yet". |
| `connected-1024-simulator.png` | ok. Acquiring after the runSimulator helper; rows aligned, no clipping. |
| `connected-1180-simulator.png` | ok. Plot and panel proportions fine, labels and controls aligned. |
| `connected-1440-simulator.png` | ok. |
| `disconnected-1024-simulator.png` | **FIND-QA-2**: "HOLD · last data" tag and held trace stay; no "No source connected" tag, no "Not connected..." hint. Em-dash fields and disabled FFT/Window read correctly. Name "Signal simulator" with idle dot. |
| `disconnected-1180-simulator.png` / `disconnected-1440-simulator.png` | Same as 1024 (FIND-QA-2). Layout ok. |
| `menu-disconnected-1024-simulator.png` | ok. Single simulator row "Built-in / Disconnected", fixed block, "Add source…". The popover stays inside the window and over the Averaging row only as a popover should. |
| `connected-1024-zoom200-simulator.png` | ok (simulated 200%). |
| `connected-1180-zoom200-simulator.png` | ok (simulated 200%). Measurement labels and controls aligned. |
| `injected-sa430-shaped-rows-1024-simulator-fake.png` | ok. Frequency step and Reference level rows fit, aligned with the other rows. Fake rows (cloned DOM), unit "traces" on Frequency step is the artifact noted above. |
| `injected-sa430-shaped-rows-1440-simulator-fake.png` | ok (same, 1440). |
| `averaging-committed-1024-simulator.png` | ok. Averaging 7, Avg 7/7, focus stays. |
| `focus-span-1024-simulator.png` | ok. Focus ring visible on Span. |
| `startup-1024-after-restart.png` | ok. Final state after restart. |

## Findings

| ID | Severity | Summary | Evidence | Owner / next step |
| --- | --- | --- | --- | --- |
| BUG-QA-1 | **High (blocks commit)**, test defect | `migration-dup.e2e.ts` "wrote version 3 with one record and left a backup": expects `sources.json` to hold one record, finds two. | `evidence/e2e-full.log` lines for worker 0-4; the second record is `{driverId: simulator, deviceId: null, name: "", label: "Signal simulator", id: src-1a1f26ebd14}`, created by the launch fallback at 06:11 UTC | Root cause below. Developer (014/015 T5) to update the spec. Not a migration bug. |
| FIND-QA-2 | Medium (design decision) | After Disconnect with a trace still on screen, the plot tag shows "HOLD · last data" and neither "No source connected" nor "Not connected. Use the source button to connect." is shown. Design 5 S13 and 7 specify both. | `disconnected-1024/1180/1440-simulator.png`; `SpectrumView.tsx` `plotHint` returns null when a frame is held (`if (hasFrame) return null`, line 56), so the S13 hint is only shown with no trace on screen; the disconnected hint code path itself is correct (line 61) | Designer + PM: either the held trace is the S13 state (update the design) or the tag and hint must show with a held trace. Likely pre-existing hold behaviour; not compared with HEAD. |
| FIND-QA-3 | Low (wording) | AC #45 says "Freq. step"; the shipped label is "Frequency step" (design Q-24). | Story AC text vs `design.md` 7 | PM: align the AC text or the label. |
| FIND-QA-4 | Info | Center's accessible name is "Center frequency" while the visible label is "Center". Label-in-name passes; the name is more verbose than the label. | Probe 1 `rowsConnected` | Optional. |
| FIND-QA-5 | Info, not reproduced | Visual hover test "the hover actions of ... did not settle" (1024 px, flaky #24/#42). Did not fail in the full e2e run or in two reruns (3 of 3 passing). | `evidence/visual-rerun-*.log` | Not a regression seen in this change. HEAD was not built for a comparison because the failure did not recur; say so if it returns. |

### BUG-QA-1 root cause

The no-device launch now connects the simulator through `remember::auto_connect` (ADR 0017, `plan.md` item 1: "remembered, becomes `lastSourceId`"). That stores an unnamed simulator record in `sources.json` on the first no-device launch. The migration itself is correct: version 3, one merged SA430 record (`src-1a19264b6bb`), a `sources.pre-v3-*.json` backup with version 2 and two records, and the rename-and-restart test passes. The spec's `toHaveLength(1)` on the file predates the launch fallback. The UI does not show the unnamed record (R11), so the menu assertion passes.

Fix options:
- (a) Preferred: the spec counts only device records (or expects exactly the SA430 record plus one unnamed simulator record).
- (b) Product question for PM and staff engineer: should the unnamed fallback simulator be stored at all? It adds one hidden record per profile. Keep unless the PM says otherwise.

## Checks still needing the SA430 attached

Run these in the second pass with the cable in. Use `SPECTRUM_E2E_SA430=1 npm run e2e:run -- --spec e2e/specs/sa430.e2e.ts` for the automated ones; the rest are manual steps listed in the header of `sa430.e2e.ts`.

1. #46.2 launch with the SA430 connected and selected, not the simulator (env-gated first test).
2. #46.3 plug in over an idle simulator: the device replaces it, Connecting… then Connected.
3. #46.4 busy port at launch: the device is Failed, selected, no simulator (env-gated busy-port test, plus a manual busy-port check if the test is skipped).
4. #46.6 plug in during an acquisition: no interruption; the device appears as New under Detected devices.
5. #45.1 real Measurement rows for the SA430: Center, Span, Frequency step, Reference level, Averaging; hold row and capture last. Screenshots at 1024, 1180, 1440 and 200% with the real labels and the real device name (22 characters).
6. #45.2 Source settings for the SA430 contain no Frequency step or Reference level.
7. #45.5 Frequency step and Reference level applied from Measurement: value on the device, same validation (10 to 500 kHz), error banner on rejection, focus stays (env-gated test).
8. #45.6 keyboard and screen reader names of Frequency step ("Frequency step, kHz") and Reference level (the description text).
9. Focus when the focused kind row leaves (plug in over the simulator while the focus is in FFT size): focus moves to Averaging.
10. Long device name (the SA430 serial is 22 characters) in the Measurement source button at 1024 and 200%.
11. The `Frequency step` label column with the real control and unit (`kHz`) at 1024/1180/1440 (the fake measured the column; re-check with the real row).

## Method notes

- Probes were temporary WebDriver specs in `e2e/specs/` (removed after the run; kept in `evidence/probe/specs/`). The "Acquiring" label on the connected rows in probe 1 came from the `runSimulator` helper, which picks and starts acquisition; the launch-state idle screenshot is `launch-1024-simulator.png`.
- The 200% checks use `document.documentElement.style.zoom = '2'` (the webview does not zoom from the keyboard; see the webview-zoom memory). Media queries are not re-evaluated.
- The SA430 rows were checked with injected DOM clones (`evidence/probe/probe2.json`); the layout is the real CSS, the values are not the device's.
- Not built: a HEAD baseline. Not needed for the hover flake (not reproduced); needed for FIND-QA-2 if the PM wants to know whether the held trace on disconnect is new.

## Residual risk

- Hardware paths (#46.2, .3, .4, .6; #45.1, .2, .5, .6 for the SA430) rely on Rust and Vitest coverage plus the manual checklist. The real plug/unplug timing is not exercised.
- Start-up failure (S12) copy is unit-tested only.
- The hover flake (FIND-QA-5) is intermittent; 3 passes in a row is not proof.

---

## SA430-attached run (014 + 015, second QA pass)

Tester: qa. Date: 2026-11-19. Hardware: TI SA430 `08FF41E50F8B3A34` on `/dev/ttyACM0` (lsusb 2047:0005), attached and idle. Tree: uncommitted working tree on `feat/40-measurement-source-capture`, binary rebuilt with `npx tauri build --debug --no-bundle` (6.7 s, incremental) before the e2e.
Raw logs and JSON: `evidence/sa430-run/` (gitignored). Curated screenshots: `screenshots/` (names `<state>-<width>-<data>`, data `sa430` = real device, `simulator`, `seeded` where noted).

### Verdict: FIX FIRST

The device behaviour of #46 is correct on the real SA430: launch selects and connects it without acquiring, an idle simulator is replaced by a plug-in, a plug-in during acquisition does not interrupt it, and a busy port at launch ends Failed with no fallback. The Measurement rows of #45 are in the right order and the values apply. Three things block a ship:

1. **Test defect (blocks green e2e with an analyzer attached):** the launch-state guard `analyzerAtLaunch()` (`e2e/specs/helpers.ts`) returns false when the SA430 is connected by the launch auto-connect, because it runs before that connect has begun. Three specs then run the no-analyzer expectations and fail: `startup` (1), `acquisition` (1, and its cascade of 8 more, which pass once the test is skipped: 20/20), `persistence` (1). Details in "Failures with the analyzer attached" below. Developer to fix the guard (wait for the launch connect to settle, bounded, before deciding).
2. **FIND-SA-1 (Medium):** a device with no known capabilities (Failed at launch, or remembered and not connected after a restart) hides Frequency step and Reference level instead of showing them as em dash, disabled (014 design, state table "Error" and "Disconnected (selected)").
3. **FIND-SA-2 (Medium):** an invalid Frequency step shows only the red border and a tooltip. No visible message, and the range is not in kHz (design 4.4 and 6: "Allowed range: 10 kHz – 500 kHz", the message visible). This is the shared `NumberField` behaviour that 014 inherits ("validation: the same as today"), so it is not new, but the design asks for the message. PM decision: fix now or accept as today's behaviour.

Not blockers, for the PM's list: FIND-SA-3 to FIND-SA-6 below. S10 (device lost while acquiring) and the physical plug/unplug checks are still open and need the human (manual steps at the end).

### Test matrix results (SA430-attached)

#### #46 default simulator (device attached)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 46.1 | No device at launch: simulator selected, connected, not acquiring | **Not run here** (needs the cable out). PASS in the no-device run above. The launch-not-acquiring rule was checked with the device: see 46.2. | `qa.md` section above |
| 46.2 | SA430 at launch: selected and connected, not the simulator, not acquiring | **PASS** | `sa430.e2e.ts` test 1 (10 passing in the isolated run). `qa-015-replug` A1: label "Source: SA430 08FF41E50F8B3A34, Connected", acquire `idle`, liveness `stopped`. `screenshots/launch-1440-sa430.png` |
| 46.3 | Idle simulator (connected, not acquiring) is replaced by a plug-in: user-picked case | **PASS** | Probe A2: simulator selected and idle, then `sa430 reboot`. After the command returned, the label went from "Signal simulator, Connected" to "SA430…, Connecting…" about 0.8 s later and to "SA430…, Connected" 0.16 s after that; acquire `idle`. `evidence/sa430-run/json/replug.json` (`replugTimelineIdle`). `screenshots/replug-over-idle-simulator-1440-sa430.png` |
| 46.3b | Same, auto-started simulator (no device at launch) | **Not run** (cannot produce a device-free launch with the cable in). Core test "Added while the simulator is idle" covers it. Manual step 2. | - |
| 46.4 | Device detected at launch, port busy: Failed, selected, no simulator | **PASS** | Probe B1: holder on `/dev/ttyACM0` (TIOCEXCL), `browser.reloadSession()`, after 3 s: label "Source: SA430 08FF41E50F8B3A34, Failed", state Disconnected, banner "Could not connect to TI SA430 spectrum analyzer: Could not open /dev/ttyACM0: serial port error: Device or resource busy…", no simulator. Then the port freed and `sa430 reboot`: auto-connected, "Connected" (B2). `json/busy-launch.json`, `screenshots/failed-at-launch-1440-sa430.png` (see FIND-SA-1 for the rows) |
| 46.4b | Busy port picked by hand (remembered row): Failed, selected, no fallback | **PASS** | `sa430.e2e.ts` "a device whose port is busy fails into Failed..." (isolated run, 10 passing) |
| 46.5 | "Loading…" before the backend answers | Device launch: **not observed** in this run (the app is ready before the first poll). Simulator launch PASS in the no-device run. | - |
| 46.6 | Simulator acquiring, SA430 plugged in: acquisition not interrupted | **PASS** | Probe A3: `runSimulator()` (Acquiring, live), `sa430 reboot`, 4 s later still "Signal simulator, Acquiring", liveness `live`, frame counter 28 → 164 (the simulator kept producing). `screenshots/plugin-during-acquisition-menu-1440-simulator.png` |
| 46.6b | After the capture stops, the plugged-in device | **Observed, open question** (FIND-SA-6). The device is not connected by itself after the stop: "Signal simulator, Connected", idle, and the device stays a row in Your sources. | `json/replug.json` (`afterStopLabel`) |
| 46.7 | Disconnect keeps the selection; the button never reads "Choose a source" | **PASS** | `ensureDisconnected()` in every SA430 spec: "SA430 …, Disconnected" (P4, `screenshots/disconnected-held-1440-sa430.png`); `acquisition` "disconnect keeps the selection" passes (isolated run) |
| 46.x | At launch the app never starts acquiring by itself | **PASS for the device launch** (A1, sa430 test 1: idle). The simulator launch is covered by the no-device run (PASS). | - |

#### #45 Measurement rows (real SA430)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 45.1 | Connected SA430 rows: Center, Span, Frequency step, Reference level, Averaging; source button first, hold row and capture last | **PASS** | Probe M1: `.measurement-rows` children in DOM order: source button, Center, Span, Frequency step (kHz), Reference level (-35 dBm), Averaging (traces), Max/Min hold + Reset, capture. Tab order from the source button: Center, Span, Frequency step, Reference level, Averaging, hold checkboxes (probe M2). `screenshots/connected-1440-sa430.png` |
| 45.2 | Source settings no longer lists them and shows its hint | **PASS** | Probe M1: "Source settings: This source has no additional settings." `sa430.e2e` test 6 checks the same. `screenshots/connected-1440-sa430.png` (collapsed; the text is from the DOM) |
| 45.3 | Simulator rows | PASS (no-device run, unchanged) | - |
| 45.4 | A setting a source does not use is hidden, not disabled | **PASS when connected or disconnected after use** (P4 and D1: Frequency step and Reference level shown as em dash, disabled). **FAIL for a device with no known capabilities** (FIND-SA-1). | `screenshots/disconnected-1180-sa430.png`, `screenshots/failed-at-launch-1440-sa430.png` |
| 45.5 | Frequency step and Reference level from Measurement apply to the device, with the same validation, errors and focus | **PASS** for apply and focus; **validation shows no visible message** (FIND-SA-2). Frequency step: 50 kHz applied (N1, `sa430` test 6), 200 kHz applied (N3, P1), 100 restored; ArrowUp 100 → 105 and ArrowDown back (P3). Invalid 5 kHz: kept visible on Enter with `aria-invalid="true"`, blur reverts to the stored 50 (N2). Value over the device limit: 10 kHz at 10 MHz span (1001 points, limit 800) is refused at commit with the banner "A 10 MHz span with 10 kHz steps needs 1001 points, more than the 800 the SA430 can sweep responsively. Increase the frequency step or choose a smaller span.", value back to 100 (S1). Reference level: -35 to -45 applied, -35 restored (N4); ArrowDown -35 to -40 with focus kept on the select (P2). Focus stays on the field after Enter (N3, P1: `measurement-stepKhz`). | `json/measure2.json`, `json/measure3.json`, `json/sweep-limit.json`, `screenshots/invalid-frequency-step-1440-sa430.png`, `screenshots/reflevel-applied-1440-sa430.png` |
| 45.6 | Keyboard order = visual order; screen readers announce label and unit | **PASS** for order and names. Frequency step: accessible name "Frequency step", `aria-describedby` = the help text and the unit "kHz". Reference level: name "Reference level", description = its help text. Center's name is "Center frequency" (as before). Two controls named "Reference level" (Display and Measurement, Q-25) are told apart by value and description only. | `json/measure.json` (`stepAria`, `describedTexts`, `tabOrder`) |
| 45.x | Layout at 1024, 1180, 1440 and 200 percent zoom (simulated, see the zoom memory) | **PASS, with FIND-SA-4 (alignment)**. No overflow: label `scrollWidth == clientWidth` on every row at 1024 and 1180 (`json/measure2.json` n5_*), `overflow: []` at 200% (`json/measure.json` zoom200_*). Labels do not clip; "Frequency step" fits (179 px label in a flexible column). | `screenshots/connected-1024-sa430.png`, `connected-1180-sa430.png`, `connected-1024-zoom200-sa430.png`, `connected-1180-zoom200-sa430.png` |
| 45.x | Long strings: 57-char device name in the Measurement source button at 1024 and at 200% | **PASS** (ellipsis, no overflow: `buttonScroll == buttonClient` 303/303, at 200% too). The full name is in the button's `title` (`SourceButton.tsx`, name span). | `screenshots/long-name-60-1024-sa430.png`, `screenshots/long-name-60-1024-zoom200-sa430.png` |
| 45.x | Disabled Frequency step and Reference level with no source | **PASS** (P4, D1): em dash, `disabled`, reason in the description. Capture button `disabled`, computed opacity 0.6 (D1). | `screenshots/disconnected-held-1440-sa430.png`, `screenshots/disconnected-1180-sa430.png` |

#### Fix pass (BUG-QA-1, FIND-QA-2) on the real device

| Check | Status | Evidence |
| --- | --- | --- |
| BUG-QA-1 `migration-dup` "wrote version 3 with one record" | **PASS** in the full `npm run e2e` run (device attached) | `evidence/sa430-run/e2e-full-sa430-attached.log` line "[0-4] PASSED ... migration-dup.e2e.ts" |
| FIND-QA-2: after Disconnect a held trace shows "No source connected" | **PASS on the real device** (P4, D1). Hint: not shown over the held trace, as designed. | `screenshots/disconnected-held-1440-sa430.png`, `screenshots/disconnected-1180-sa430.png`, `json/measure3.json` (`p4Liveness` noSource) |
| S10 device lost while acquiring: held trace, banner "lost", no simulator | **NOT RUN** (needs a physical unplug; `sa430 reboot` is refused while the app holds the port, see hardware-replug memory). The seeded visual state "banner-device-lost" (simulator) shows the banner and "No source connected", not HOLD: that is the no-frame state, unit-tested for the held case. | manual step 4 below; `evidence/sa430-run/shots-visual/banner-device-lost-1024.png` |

#### Automated gates

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run check` (this tree, before the e2e) | exit 0. cargo fmt, clippy -D warnings, cargo test (all binaries, 0 failed), Prettier, ESLint, tsc, Vitest 58 files / 805 tests passed | `evidence/sa430-run/check-sa430.log` |
| `npm run e2e` full, device attached (debug build) | exit 1: **9 spec files passed, 3 failed** (`startup` 1, `acquisition` 1, `persistence` 1). 47 visual passing, 3 skipped, `sa430` skipped (env not set), `migration-dup` PASS, `persistence` hover tests PASS. All 11 workers auto-connect the one SA430, so the hardware specs are not a clean signal in the full run (known; `docs/testing.md`). | `evidence/sa430-run/e2e-full-sa430-attached.log` |
| `startup`, `acquisition`, `persistence` alone | `startup` 3 pass, 1 fail (guard). `acquisition` 12 pass, 9 fail (the guard test, then a cascade). `persistence` 4 pass, 1 fail (guard). | `evidence/sa430-run/iso-*.log` |
| `acquisition` with only the guard test skipped (probe copy) | **20 passing** | `evidence/sa430-run/iso-acq-noguard.log` |
| `SPECTRUM_E2E_SA430=1 sa430.e2e.ts` | **10 passing** (all, incl. busy port, Frequency step in Measurement, single capture, Cancel BUG-1 x5) | `evidence/sa430-run/e2e-sa430.log` |
| `SPECTRUM_E2E_SA430=1 visual.e2e.ts` | **49 passing, 1 skipped** (two-analyzer state). Hover tests passed, no "did not settle" | `evidence/sa430-run/sa430-visual.log`, shots in `evidence/sa430-run/shots-visual/` |
| `SPECTRUM_E2E_SA430=1 add-source.e2e.ts` | **8 passing** (Test connection OK with serial, second row refused) | `evidence/sa430-run/sa430-add-source.log` |
| Persistence hover flake (#24/#42) | Not reproduced: the hover tests of `persistence` and `visual` passed in every run here. The one persistence failure is the guard (above). | - |

### Failures with the analyzer attached (test defect, not product)

- **Guard race (root cause):** `analyzerAtLaunch()` checks `sessionState() === 'Connected' && data-simulated null`. It runs right after `waitForAppReady()`, which returns before the launch auto-connect has started, so the state is still not Connected and the function returns false. The no-analyzer expectations then run against the SA430 and fail. Repeatable: 3 of 3 runs (full, isolated, and the sa430 spec's own launch check passes because it waits for Connected). `startup` "starts with the simulator selected... when no analyzer is attached" fails; `persistence` "restores preferences, the last source..." takes its else-branch ("E2E FM setup") and fails; `acquisition` test 1 fails and leaves the suite on the SA430, so 8 later tests cascade with "element click intercepted" (the cascade is not product: the same file with test 1 skipped passes 20/20).
- Fix direction (developer): make the launch decision wait for the first settled startup state (Connected, Failed, or a no-device Connected simulator), with a bounded wait (about 3 s), before deciding. The no-device launch must still run for real.
- Note for the persistence spec: with an analyzer attached the launch rule gives the detected device priority over the remembered "last used" source (story 015: "A detected device still takes priority at launch"). So the restore assertion can only hold with no analyzer; the spec needs the same guard, computed correctly.

### Findings

| ID | Severity | Summary | Evidence | Owner / next step |
| --- | --- | --- | --- | --- |
| FIND-SA-1 | Medium | A device with no known capabilities (Failed at launch, or remembered and not connected after a restart) hides Frequency step and Reference level. The 014 design says em dash, disabled ("Error (connect failed)" and "Disconnected (selected)" rows of its state table). The rows appear when the device connects, so the Averaging row jumps by two rows. Only the no-capabilities path is affected; the session path (P4) shows them disabled. | `screenshots/failed-at-launch-1440-sa430.png` (Center, Span, Averaging only) | Designer + developer: show the two rows disabled with the last known kind, or the em dash when unknown (design 014 table). Restart with a remembered, unplugged device is the same mechanism (from the code; not run separately). |
| FIND-SA-2 | Medium | Invalid NumberField entry: red border and the tooltip "Enter a whole number between 10 and 500" only. No visible message, and the description (`aria-describedby`) carries no error text, so a screen reader user does not hear why. The range is not shown in kHz (design: "Allowed range: 10 kHz – 500 kHz"). Shared by all NumberFields (Averaging, Range, Peaks). Pre-existing (014: "validation the same as today"). | `screenshots/invalid-frequency-step-1440-sa430.png`, `json/measure2.json` (`n2EnterTitle`, `n2EnterDescribedBy`) | PM: fix now (design says message visible) or accept as today's behaviour and open an issue. |
| FIND-SA-3 | Low | Two controls named "Reference level" in the same side panel (Measurement, device dBm; Display, plot dB). Designer accepted (Q-25). The screen reader name is the same; the description differs. | `screenshots/connected-1440-sa430.png` | Designer: accepted; keep under review. |
| FIND-SA-4 | Low | Control left edges in the Measurement group do not align: Center, Span and Reference level at 1288 px (1440 window), Averaging about 1296, Frequency step about 1310. Number inputs are 90 px plus a unit suffix, so the unit width moves the edge. Same convention as the Display "Range" row, so not new. | `screenshots/connected-1440-sa430.png`, `evidence/sa430-run/shots-visual/panel-acquiring-real-1024-sa430.png` | Designer: decide whether the units column should be fixed width. |
| FIND-SA-5 | Low | The first pass (M3, M4 of the probe) timed out once: a 50 kHz step did not show as 50 and a Reference level select did not change. Not reproduced in four later runs of the same actions (N1, N4, P1, P2). Cause not found. | `evidence/sa430-run/probe-measure.log` | QA: re-check if it recurs; no fix planned. |
| FIND-SA-6 | Info (question) | A plug-in during an acquisition is not acted on after the capture stops. The device stays a row in Your sources, idle; the user must pick it. The sa430 spec header says "the device is not connected until the simulator is stopped", which can be read either way. | `json/replug.json` (`afterStopLabel`, `afterStopState`) | PM: confirm that "not connected after the stop, user picks it" is intended; then update the spec header. |

### Manual steps for the human (physical unplug and replug; not automated)

Run with the SA430 on the USB port, the app running (`npm run tauri dev` or the debug build), and nothing else holding `/dev/ttyACM0`.

1. **Launch with the device unplugged (no-device launch, 46.1, 46.5, 46.x).** Quit the app. Unplug the SA430. Start the app. Expect: "Source: Signal simulator, Connected", capture idle, plot "No trace yet. Press Continuous", no acquisition started by itself. Watch the source button at start-up: it reads "Loading…" first and must never read "Choose a source".
2. **Plug in over an idle simulator (46.3).** With step 1 done and the simulator still selected and idle, plug the SA430 in. Expect: the label changes to "SA430 …, Connecting…" and then "Connected" within a few seconds, with no click. The simulator row is no longer current in the menu.
3. **Plug in during an acquisition (46.6).** Unplug the SA430 again, select the simulator, press Continuous. Plug the SA430 in while frames arrive. Expect: the frame counter keeps rising, the button stays Pause, the label stays "Signal simulator, Acquiring". Stop the capture and report whether the device connects by itself (QA observed: no; see FIND-SA-6).
4. **Unplug while the SA430 acquires (S10).** Connect the SA430 (the app auto-connects at launch or pick it), press Continuous, let a few frames arrive, then unplug the cable. Expect: the banner says the device was lost, the plot keeps the last trace marked HOLD (the time tag), the source button keeps the SA430 name with "Not detected", the Measurement rows stay with em dashes where a value is unknown, and no simulator connects by itself. Take a screenshot at 1024 and 1440. Then plug the cable back in: expect the device to reconnect or to be offered in Detected devices; report which.
5. **Busy port at launch, real cable (optional, 46.4).** Replace step 4 with: start a second process that holds the port with TIOCEXCL (the sa430 spec's `holdPort` script), restart the app, and check "Failed" with no simulator. Automated already (probe B1); manual only if the human wants a real cable check.

### Residual risk

- The three guard-race failures are test defects, but until they are fixed, any run with the analyzer attached is red for reasons that are not product defects. Do not read the full e2e result with an analyzer attached as a product signal until then.
- Probe-only evidence: the 200% checks are root CSS zoom (media queries not re-evaluated, see the zoom memory). The probes measured injected or real rows; the SA430's own rows were measured on the real device.
- Unplug/replug timing with the real cable (steps 1-4) is not exercised by this run; `sa430 reboot` simulates re-enumeration only while the app does not hold the port.

### Cleanup

- Temporary probe specs (`qa-015-replug`, `qa-015-busy-launch`, `qa-015-measure`, `qa-015-measure2`, `qa-015-measure3`, `qa-015-disabled`, `qa-015-sweep-limit`, `qa-015-acq-noguard`) were removed from `e2e/specs/` before the full e2e and kept in `evidence/sa430-run/probe-specs/`. Nothing under `e2e/` is changed by QA.
- No GitHub issues were filed. All findings are in this file for the PM.
