# 003 Play/Pause acquisition button: QA

Tester: qa. Build under test: the uncommitted working tree on `main` (no commits, no production code changed).
Binaries: working tree `target/debug/spectrum-studio` (copy `/tmp/claude-1000/qa-current-binary`); baseline HEAD built
from `git archive HEAD` (copy `/tmp/claude-1000/qa-baseline-binary`). Screenshots: `screenshots/`. Logs: `evidence/`.

## Verdict: DON'T SHIP (yet)

- Acceptance criteria 1 to 5 hold in the real app (screenshots and DOM checks).
- Criterion 6 (keyboard) fails: Space/Enter do activate, but **keyboard focus is dropped from the button after every
  Play/Pause activation** (BUG-1, major). The same defect exists at HEAD for Run/Stop, so it is inherited, not new,
  but the story's keyboard criterion is not met in practice.
- `npm run check` is green. The full `npm run e2e` is red, but the red is the visual guard's hover test, which
  also fails at HEAD (see Regression). Nothing in the Play/Pause specs fails.

## Test matrix

Status: pass / fail / blocked / not-run. "UI" rows cite screenshots (visually inspected with the Read tool).

| # | Criterion / edge case | Evidence | Status |
| --- | --- | --- | --- |
| AC1 | State label pill gone; SIMULATED badge stays; connection state via source glyph and its accessible name | `screenshots/connected-1180-sim.png`, `acquiring-1180-sim.png`: no pill, SIMULATED present. `evidence/screens-log.json`: `stateLabelPresent` 0 in all states; source aria `Source: Signal simulator, Connected` / `Acquiring` / `Disconnected`; real SA430 `Source: SA430 08FF41E50F8B3A34, Connected` | pass |
| AC2 | One icon-only button in the Run/Stop place; Play icon when connected, Pause while acquiring, no text | `screenshots/connected-1180-sim.png` (Play, left of SIMULATED), `acquiring-1180-sim.png` (Pause). DOM: `innerText` empty, icon is inline SVG, `aria-label` set | pass |
| AC3 | Play starts acquisition (`start`); icon becomes Pause only when backend reports `acquiring` | e2e `acquisition.e2e.ts` "plays again with the same settings" (waitForState Acquiring, then Pause aria). Log: Pause shown with `Acquiring` source aria. Real SA430: `screenshots/acquiring-1180-real.png` shows Pause with LIVE | pass |
| AC4 | Pause stops (`stop`); no new frames; last trace frozen (not cleared); icon back to Play; Play again resumes with same settings | `screenshots/paused-1180-sim.png`, `paused-1024-sim.png`, `paused-1180-real.png`: trace still drawn, badge "HOLD · last data 00:01:30", Play shown, liveness `stopped` in `evidence/screens-log.json`. e2e "pauses: the last trace stays on screen..." and "plays again with the same settings": pass | pass |
| AC5 | Disabled when no device connected (incl. remembered-but-not-connected, device lost), and while connecting/disconnecting/starting/stopping; Play does not auto-connect | `screenshots/disconnected-1180-sim.png`, `disconnected-1024-sim.png`: Play dimmed (opacity 0.45, pixel 37,115,102 vs 62,224,181 connected). DOM `disabled` = true, title "Connect a source first". `visual-guard/toolbar-idle-60-1024-seeded.png`: dimmed with failed source. Unit: `Toolbar.test.tsx` disables for connecting/disconnecting/busy and "starts acquisition from Play without connecting first" (asserts no connect call). e2e acquisition "disconnects..." expects Play disabled. Connecting/disconnecting transitions observed only through unit tests (not observed live) | pass (live: disconnected, remembered, failed states; transitional states unit-tested only) |
| AC6a | aria-label "Start acquisition" / "Pause acquisition" | DOM log: `acquireAria` = Start / Pause in every state | pass |
| AC6b | Tooltip (title); disabled tooltip "Connect a source first" | DOM: `title` = "Connect a source first" (disabled), "Start acquisition", "Pause acquisition". Native tooltip popup is not captured by WebDriver screenshots, so the visible tooltip is **not verified**. Attributes only | pass (attribute), visible tooltip not-run |
| AC6c | Keyboard focusable; visible focus ring | `screenshots/focus-play-1180-sim.png`, `focus-play-1024-sim.png`, `focus-pause-1024-sim.png`: blue 2px ring visible on Play and on Pause. Computed `outline: solid 2px rgb(90,169,255)`, `:focus-visible` true | pass |
| AC6d | Space and Enter activate | Space starts (QAA-SPACE: Acquiring) and Enter pauses (QAA-ENTER: Connected) when focus is still on the button (`evidence/qa-focus-current.log` diagnostics, first sequence). Space pause from Pause state: works, but see next row | pass (activation) |
| AC6e | Focus stays on the control after activation so repeated keyboard use works | `screenshots/focus-lost-after-keyboard-pause-1024-sim.png`: no ring, focus on BODY. `evidence/screens-log2.json` `afterSpacePause` = BODY. Trace (`evidence/qa-focus-run1.log`, run2, current): button `disabled=true` at 31-71 ms, `focusout` on acquire-button at 36-73 ms, re-enabled at 43-89 ms, focus stays on BODY; Enter afterwards does nothing (state stays Acquiring). 3 of 3 traces reproduce | **fail, BUG-1 (major)** |
| AC6f | Square, same height as source button | `evidence/screens-log.json` geom: acquire 30 x 30; source button height 30 in all states (CSS `height: var(--control-height)`) | pass |
| AC6g | No layout shift between Play and Pause | geom: acquire left 304.52 and freq field left 470.75 identical in connected, acquiring and paused (1180 and 1024). Toolbar strip of disconnected, connected, acquiring, paused and focus states: `screenshots/toolbar-compare.png` | pass |
| AC6h | Icons are inline SVG and render on WebKitGTK | Play and Pause glyphs visible in every screenshot | pass |
| AC6i | Icon centring | Zoomed crops `screenshots/play-zoom.png` (connected, acquiring, focus, disabled) show the triangle optically centred and bars centred in the 30 px box | pass |
| AC6j | Pause colour while acquiring (amber, `.stop`) | `screenshots/acquiring-nohover-1024-sim.png`: amber fill, dark pause bars (computed `rgb(255,181,71)`). Hovered Pause turns teal (see BUG-3, cosmetic) | pass with BUG-3 |
| AC7 | Unit tests (Toolbar) and e2e specs updated; `npm run check` passes | `evidence/qa-check.log`: `npm run check` EXIT 0. cargo: 153 passed, 0 failed, 3 ignored. vitest: 22 files, 201 tests passed. Tests assert behaviour (disabled attributes, start/stop calls, no connect call, frame kept after pause). Gap: no unit or e2e test of keyboard focus or Space/Enter | pass (gap noted) |
| AC-b | Edge: invalid input / no source chosen | `screenshots/`: first-run no-source Play disabled was checked in the unit test ("disables Play until a source is chosen"); not captured live (QA run kept the seeded remembered source) | pass (unit), live not-run |
| AC-c | Edge: disconnect/device loss during acquisition | e2e `failures.e2e.ts` "detects device loss during acquisition and recovers with Reconnect" uses the Play button: pass in full run | pass |
| AC-d | Edge: repeated start/stop | Toggled Play/Pause 3 times on the simulator and once on the real SA430 with no state drift (`evidence/screens-log.json`) | pass |
| AC-e | Edge: long names (60 chars) with Play/Pause | `screenshots/visual-guard/toolbar-acquiring-60-1024-seeded.png`, `toolbar-connected-60-1180-seeded.png`: source name truncated with ellipsis, Play/Pause square and not pushed; full name is in aria-label | pass |
| AC-f | Edge: units dBFS vs dBm | Simulator acquiring: axis dBFS, status "Uncalibrated"; SA430 acquiring: axis dBm, status "Unit dBm" (`screenshots/acquiring-1180-real.png`). Labels unchanged by this work | pass |
| AC-g | Edge: persisted-file corruption | Covered by existing `failures.e2e.ts` ("bad sources.json" seed); not affected by this change. Full e2e run: pass | pass (regression) |
| AC-h | Narrow window 1024 (min) | `screenshots/paused-1024-sim.png`, `connected-1024-sim.png`, `disconnected-1024-sim.png`, `visual-guard/*-1024-*`: toolbar fits, no sideways scroll (`docScrollW` = 1024) | pass |
| AC-i | Empty / loading / error states | Error state: `visual-guard/toolbar-idle-60-1024-seeded.png` (failed SA430, red cross, Play dimmed, failure banner). Empty: `disconnected-1180-sim.png` shows "No source connected" | pass |
| Reg-1 | Regression: `visual.e2e.ts` hover/focus test (see Regression section) | `evidence/qa-visual-current.log`, `evidence/qa-e2e-current-rerun.log`, `evidence/qa-visual-baseline.log` | **fail at HEAD too; pre-existing** (see Regression) |
| Reg-2 | Regression: other e2e specs | Full run: 9 spec files pass on rerun; `source-row.e2e.ts` failed once in the first full run (9 of 10) and passed on rerun and alone (current and baseline) | pass (one flaky first-run failure, see below) |

## Screenshots (opened and inspected)

| File | Finding |
| --- | --- |
| `screenshots/disconnected-1180-sim.png` | ok: Play dimmed (disabled), "Signal simulator" shows grey dot (Disconnected), no state pill, bottom bar "No source connected." |
| `screenshots/connected-1180-sim.png` | ok: bright Play, SIMULATED badge, centred glyph. Defect: bottom bar says "press Run to start acquisition." (BUG-2) |
| `screenshots/acquiring-1180-sim.png` | ok glyph and layout; **hovered** Pause shows teal, not amber (BUG-3, cosmetic). Focus not present |
| `screenshots/acquiring-nohover-1024-sim.png` | ok: amber Pause (warn), dark bars, LIVE trace |
| `screenshots/paused-1180-sim.png` | ok: trace frozen and drawn, "HOLD · last data 00:01:30", Play back |
| `screenshots/paused-1024-sim.png` | ok at minimum width: toolbar fits, HOLD badge, Play |
| `screenshots/toolbar-compare.png` | ok: crops of 8 toolbar states (dimmed Play when disconnected, bright Play, amber Pause, focus ring, real SA430) |
| `screenshots/states2.png` | ok: amber Pause without hover; Pause with focus ring; focus lost (no ring) after keyboard pause; real SA430 Pause |
| `screenshots/paused-1180-real.png` | ok with real SA430 (`SA430 08FF41E50F8B3A34`): trace frozen, HOLD, dBm axis |
| `screenshots/connected-1180-real.png` | ok: real device name fully visible; Play square and aligned |
| `screenshots/acquiring-1180-real.png` | ok: Pause on real hardware, LIVE, dBm unit |
| `screenshots/focus-play-1180-sim.png` | ok: 2px blue focus ring around Play after Tab |
| `screenshots/focus-play-1024-sim.png` | ok: same ring at 1024 |
| `screenshots/focus-pause-1024-sim.png` | ok: ring around amber Pause |
| `screenshots/focus-lost-after-keyboard-pause-1024-sim.png` | **defect**: after Space on Pause, no ring anywhere, focus on BODY (BUG-1) |
| `screenshots/disconnected-1024-sim.png` | ok: dimmed Play, fits |
| `screenshots/connected-1024-sim.png` | ok |
| `screenshots/acquiring-1024-sim.png` | ok |
| `screenshots/visual-guard/toolbar-*-22-*`, `toolbar-*-60-*` (1024 and 1180) | ok: names ellipsised with full name in aria-label, Play/Pause square, no overflow. All 12 seen in `screenshots/guard-toolbars-strip.png` |
| `screenshots/visual-guard/row-actions-1024-long-name.png` | ok: hover/focus actions visible in the badge column; no overlap with name |

Layout note (not a criterion): connecting makes the Center field jump about 81 px (389 to 470) because the SIMULATED badge
appears. It happens on connect, not on Play or Pause (`evidence/screens-log.json`).

## Regression: `visual.e2e.ts` "hover and focus move nothing, actions stay in the badge column"

Question: is it reproducible and caused by this change? **Reproducible, but not caused by this change.** The same
assertion fails at HEAD.

Facts (measured with `evidence/reproducer-measure.e2e.ts`, which I kept only as evidence and removed from `e2e/`):

| Measurement (real px, 60-char row or SA430 row) | HEAD (baseline) | Working tree |
| --- | --- | --- |
| Menu left edge (`source-menu`) | 139.875 | 139.875 |
| Source control left / right | 139.875 / 289.875 | 139.875 / 289.875 |
| Source button width x height (1180 and 1024) | 150 x 30 | 150 x 30 |
| Row item right = row right | 492.875 | 492.875 |
| Badge right | 483.875 | 483.875 |
| Actions right, hovered, settled | 484.875 | 484.875 |
| Actions right, hovered, measured immediately after moveTo | 483.767 (1180) / 484.003 (1024) | 484.098 (1180) / 483.548 (1024) |
| Actions right, focused (no hover) | 478.875 | 478.875 |

- Geometry is identical before and after. The source button is 150 px at both widths in both builds (the toolbar
  group is content-sized, so removing the state pill does not widen it), and the menu sits at the same x.
- Visual guard results. Current build: 1180 failed on the 2nd run and passed on the 1st; 1024 and 520 failed on both
  runs. HEAD: 1024 and 520 fail (on the N60 and "Seeded long port" rows), 1180 passed. The "known defect" test fails on
  both. So the statement "baseline fails only on the known defect" is not accurate: HEAD also fails this test at 1024
  and 520.

Root cause: `src/styles/source.css` `.source-actions { right: 8px }` is measured from `.source-row`. The badge column
sits inside the item: 1 px border plus 8 px padding, so the badge's right edge is 9 px from the row edge. The actions
therefore overhang the badge column by exactly 1.0 px when hovered or focused. The guard's tolerance is 0.6 px, so the
assertion passes only while the 150 ms `transform` transition (`translateX(-6px)` to `none`) is still running. The test
reads the box immediately after `moveTo()`, so whether it passes depends on timing. That is why 1180 is flaky.

Suggested fix (for developer / staff engineer, not applied): set `right: 9px` on `.source-actions` (match 1 px border +
8 px padding) so the actions sit exactly on the badge column. In the test, wait for the transition to end before measuring
the settled position (do not widen `TOL`). The "hover actions sit below the badge pill" defect is separate and unchanged.

Filed as BUG-4 (minor, pre-existing, test-visible).

## Other e2e observations

- First full `npm run e2e` run: `source-row.e2e.ts` failed 9 of 10 ("the source menu did not open", missing
  `source-entry-vis-real`). Re-running the same file alone passed (current and baseline), and the next full run passed it.
  Not attributable to this change; flagged as an intermittent failure (`evidence/qa-e2e-full.log`).
- Second full run (current tree): 9 spec files pass; `visual.e2e.ts` fails 4 (hover at 1180, 1024, 520; known defect).
- Baseline full run (HEAD): 9 spec files pass; `visual.e2e.ts` fails 3 (hover at 1024, 520; known defect).
- Baseline run of the working-tree `visual.e2e.ts` against the HEAD binary also fails the toolbar tests that click
  `acquire-button`: a spec/binary mismatch, not a finding. Not used for comparison.

## Keyboard focus at HEAD (inherited behaviour)

Baseline binary, Run/Stop: Space on Run gives focus BODY (`evidence/qa-basefocus.log`: `QABASE-AFTER-RUN` BODY). So
the focus drop is inherited from the Run/Stop implementation (the button is disabled while `busy`), not introduced by
this work. The story's keyboard criterion still is not met, so it is listed as BUG-1 (major).

## Open bugs

| ID | Severity | Summary | Evidence |
| --- | --- | --- | --- |
| BUG-1 | major | Focus is lost after Play/Pause activation from the keyboard (button becomes `disabled` while busy) | `screenshots/focus-lost-after-keyboard-pause-1024-sim.png`, `evidence/qa-focus-run1.log`, `evidence/screens-log2.json` |
| BUG-2 | minor | Status bar still says "press Run to start acquisition." | `screenshots/connected-1180-sim.png` bottom bar; `src/components/StatusBar.tsx:53` |
| BUG-3 | cosmetic | Hovered Pause turns the Play colour (teal); `button.primary:hover` overrides `.stop` amber | `screenshots/acquiring-1180-sim.png` (hover) vs `acquiring-nohover-1024-sim.png` |
| BUG-4 | minor (pre-existing) | `.source-actions` overhangs the badge column by 1 px; guard hover test flaky and red at HEAD | `evidence/qa-measure-*.json`, `evidence/qa-visual-*.log` |

Residual risk: BUG-1 means keyboard users must Tab back to the button after each Play/Pause. Tooltips are verified as
attributes only. Transitional states (connecting, disconnecting) are verified by unit tests only.

## Commands run

- `npm run check`: EXIT 0 (`evidence/qa-check.log`). cargo fmt, clippy -D warnings, `cargo test --workspace` (153 passed,
  0 failed, 3 ignored), prettier, eslint, tsc (app and e2e), vitest (201 passed).
- `npx tauri build --debug --no-bundle` (working tree): EXIT 0.
- `npm run e2e`: first run red (source-row flake, visual hover tests); rerun: visual only (4 failing: hover at 1180, 1024,
  520 and known defect). Baseline HEAD full run: visual 3 failing. Logs in `evidence/`.
- Visual guard (`visual.e2e.ts`) against working tree and HEAD binaries: see Regression.
- Diagnostic specs (temporary, removed from `e2e/` after use; copies kept as `evidence/reproducer-measure.e2e.ts`).

## Round 2 (retest of BUG-1..4 fixes)

Tester: qa. Build under test: the uncommitted working tree after fix round 1 (developer handoff 0078). `npm run e2e`
rebuilt the debug binary (`npx tauri build --debug --no-bundle`) before the run. No production code changed; the
temporary probe specs and their seed folders were removed after use. Screenshots below were opened and inspected
with the Read tool. Zoomed crops are in `screenshots/zoom/`. Raw values are in `evidence/r2-probe-1180.json`,
`evidence/r2-probe-1024.json`, `evidence/r2-probeB-1024.json`, `evidence/r2-probeB-real.json`,
`evidence/r2-probeC-real-pause-frames.json`.

### Verdict: SHIP

BUG-1, BUG-2, BUG-3 and BUG-4 are fixed and verified in the real app. AC1 to AC5 hold in a regression pass at 1180 and
1024, on the simulator and on the real SA430. The only failing e2e test is the documented known defect, and it fails
only on its own assertion. One caveat: the double-press "no second start" check could not be counted directly (see
item 1). It is supported by the state sequence and by unit tests, not by an IPC count.

### Commands

- `npm run check`: EXIT 0 (`evidence/qa-r2-check.log`). cargo fmt and clippy clean; `cargo test --workspace`: 94, 8,
  16, 13, 14 and 8 passed, 0 failed (ignored as before); prettier, eslint (`--max-warnings 0`), tsc; vitest 23 files,
  204 tests passed.
- `PATH=/tmp/claude-1000/wkd/x/usr/bin:$HOME/.cargo/bin:$PATH npm run e2e`: EXIT 1, as expected
  (`evidence/qa-r2-e2e-full.log`, summary in `evidence/qa-r2-e2e-summary.txt`). 9 of 10 spec files PASSED, including
  `acquisition.e2e.ts` with the new "keeps keyboard focus on Play/Pause across Space and Enter presses". `visual.e2e.ts`:
  21 passing, 1 failing: "hover actions sit below the badge pill instead of covering it", with
  `Error: actions top 176.5 vs badge bottom 195`. That is the documented known defect, and it is the only `✖` in the log.
- Temporary probes (`e2e/specs/qa-r2*.e2e.ts`, seeds copied from `visual`): run with `--spec`, then removed.

### Test matrix (round 2)

| # | Item | Evidence | Verdict |
| --- | --- | --- | --- |
| R2-1a | BUG-1: Tab reaches Play and it shows a focus ring; Space and Enter keep focus on Play across repeated presses | Tab from source button: focus on `acquire-button`, computed `outline: 2px solid rgb(90,169,255)` at 1180 and 1024. Sequence Space, Enter, Space, Enter at 1180: states Acquiring, Connected, Acquiring, Connected, focus `acquire-button` after every press (`r2-probe-1180.json` `repeatedKeys`). Zooms: `screenshots/zoom/r2-zoom-kbd-focus-play-1180.png`, `r2-zoom-kbd-acq-focus-pause-1180.png`, `r2-zoom-kbd-paused-focus-1180.png`, `r2-zoom-kbd-repeat-1180.png` | **pass** |
| R2-1b | Keyboard Space then Enter at 1024 with ring kept | `r2-probeB-1024.json` `c_tabFocus1024`, `d_kbdAcquiring1024`, `e_pausedHold1024`: focus `acquire-button` throughout. Screenshots `screenshots/r2-kbd-focus-play-1024-seeded.png`, `r2-kbd-acquiring-focus-pause-1024-seeded.png`, `r2-paused-hold-1024-seeded.png` (ring on Play after pause, HOLD badge) | pass |
| R2-1c | Press during a transition does not double-fire | Two Space presses back-to-back from Connected: state Acquiring after 1.5 s, one more Space: Connected (`doublePressFromConnected`, `afterSecondSpaceStop`). The IPC call counter I installed did not record any calls (the spy missed the invoke path), so the count is **not** observed. Unit test "keeps keyboard focus on Play while busy and ignores clicks until the command ends" asserts one `startAcquisition` and no stop. | pass (state sequence and unit test; no live IPC count) |
| R2-2a | Hovered Pause is amber | Hovered Pause at 1180: computed bg `rgb(240,162,46)` (`--warn-strong`). At 1024: same. Not hovered: `rgb(255,181,71)`. Screenshots `screenshots/r2-acquiring-pausehover-1180-seeded.png`, `r2-acquiring-pausehover-1024-seeded.png`, `r2-acquiring-nohover-1024-seeded.png`, zooms `screenshots/zoom/r2-zoom-acq-pausehover-1180.png`, `r2-zoom-acq-pausehover-1024.png`, `r2-zoom-acq-nohover-1024.png` | **pass** (BUG-3 fixed) |
| R2-2b | Hovered Play is teal | Hovered connected Play: `rgb(43,199,158)` (`--accent-strong`), idle `rgb(62,224,181)`. Screenshot `screenshots/r2-connected-playhover-1180-seeded.png`, zoom `screenshots/zoom/r2-zoom-connected-playhover-1180.png` | pass |
| R2-2c | Disabled Play has no hover effect | Disconnected, hovered: bg `rgb(62,224,181)` identical to idle, `disabled` true, opacity 0.45, both at 1180 and 1024, and after a session ends (`a_disconnected1024`, `f_afterDisconnectHover1024`, `disconnectedHover`). Screenshots `screenshots/r2-disconnected-playhover-1180-seeded.png` (zoom `screenshots/zoom/r2-zoom-disconnected-playhover-1180.png`), `r2-disconnected-1024-seeded.png` | pass |
| R2-3 | Status bar copy when connected with no data | "No data yet — press Play to start acquisition." at 1180 (simulator and real SA430) and at 1024 (simulator and real SA430). Disconnected: "No source connected." Screenshots `screenshots/r2-connected-nodata-statusbar-1180-seeded.png`, `r2-connected-nodata-statusbar-1024-seeded.png`, `r2-real-connected-nodata-1180.png`, `r2-disconnected-1024-seeded.png`. Copy matches the story and the unit test (`StatusBar.test.tsx`) | **pass** (BUG-2 fixed) |
| R2-4a | Source menu hover actions sit inside the badge column, 1180 | Settled measurements (`r2-probe-1180.json`): badge left and right 419.875 / 483.875; actions left and right 419.875 / 483.875 for `vis-60`, `vis-22` and the real SA430 row. Actions top 223.5, badge top 225 (vertically centred, a 1.5 px overhang above and below the 17 px badge, horizontal edges exact). Screenshot `screenshots/r2-menu-hover-1180-vis-60.png`: pencil and × sit over the badge column, the USB badge is hidden under them, the name stays clear. Also `r2-menu-hover-1180-vis-22.png`, `r2-menu-hover-1180-vis-real.png` | **pass** (BUG-4 fixed) |
| R2-4b | Same at 1024 | `r2-probe-1024.json` (the same numbers as 1180) and `r2-probeB-1024.json`. Screenshots `screenshots/r2-menu-hover-1024-vis-60.png` (long 60-char name truncated with an ellipsis, actions inside the badge column) and `r2-menu-hover-1024-vis-22.png` | **pass** |
| R2-4c | Known defect "hover actions sit below the badge pill instead of covering it" | Fails only on its own assertion: `actions top 176.5 vs badge bottom 195` (`evidence/qa-r2-e2e-full.log`). Not a regression; still the documented known defect | known defect, as documented |
| R2-5a | AC1: state pill gone, SIMULATED stays, connection via source button | `screenshots/r2-connected-nodata-statusbar-1180-seeded.png`: no pill, SIMULATED present, source glyph and button. Unit test asserts `session-state` absent | pass |
| R2-5b | AC2: one icon-only Play/Pause in the Run/Stop place | Play glyph (no text) in every connected screenshot; Pause glyph when acquiring (`r2-acquiring-pausehover-1180-seeded.png`, `r2-real-acquiring-1180.png`) | pass |
| R2-5c | AC3: Play starts; icon becomes Pause only at backend `acquiring` | Simulator and real SA430: Play to Acquiring, Pause shown only after the state reads Acquiring (`afterSpaceStart`, `i_realAcquiring`). Screenshot `screenshots/r2-real-acquiring-1180.png` (Pause, LIVE, dBm) | pass |
| R2-5d | AC4: Pause stops; no new frames; trace frozen; Play resumes | Real SA430 after Pause: frame counter `#15` constant across six samples over 3 s (`r2-probeC-real-pause-frames.json`). Simulator and real: HOLD badge, trace kept (`r2-paused-hold-1024-seeded.png`, `r2-real-paused-hold-1180.png`, `r2-probe` samples). Play resumes after Pause (`plays again` e2e pass) | pass (see observation O-1) |
| R2-5e | AC5: Play disabled with no connected device; not auto-connecting | Disabled with the source disconnected, at 1180 and 1024 (`disabled` true, title "Connect a source first") after a disconnect of the simulator and of the real SA430 (`k_realDisconnected`). Transitional states remain unit-tested only | pass |
| R2-5f | AC6: aria-label, keyboard, focus ring, square 30 px, no layout shift | aria-label "Start acquisition" / "Pause acquisition" in every state. Square 30x30 next to the 30 px source button. Play left 304.52 and Pause left 304.52 (1180) identical. Focus ring visible (see R2-1a) | pass |
| R2-5g | AC7: unit tests and e2e updated; `npm run check` | see Commands | pass |
| R2-5h | Real hardware: SA430 connect, Play, Pause, status and units | Connected, real name shown in full (`r2-real-connected-nodata-1180.png`), dBm axis and "Unit dBm" in the status bar (`r2-real-acquiring-1180.png`). No labelling change | pass |

### Observations (not defects, no change requested before ship)

- O-1 (minor, not reproduced as a defect): in one probe on the real SA430 (`r2-probeB-real.json` `i_realAcquiring` to
  `j_realPaused`), the frame counter moved from #24 to #31 in about 0.7 s after the Pause click. Frames already in flight
  were most likely shown. A second probe (`r2-probeC-real-pause-frames.json`) read `#15` six times over 3 s after the
  click, so the trace is frozen once the stop has landed. Not a defect as far as this round can tell. Flagged only.
- O-2: the visible native tooltips ("Connect a source first", "Start acquisition") are still not captured by WebDriver
  screenshots. Attributes were checked (`title`).
- O-3: the connecting or disconnecting transitional states of Play were verified by unit tests only (as in round 1).
- O-4: the first-run screenshot shows the source button in its "Choose a source" attention ring. This is pre-existing,
  not changed by this work.

### Open bugs after round 2

None open from round 1. BUG-1 (focus), BUG-2 (copy), BUG-3 (hovered Pause colour) and BUG-4 (actions position and visual
guard timing) are verified fixed. Known defect (hover actions below the badge pill) remains, as documented.

### Residual risk

Double-press IPC count not directly observed (state sequence and unit tests agree). Native tooltips not captured. The
hover-then-focus WebDriver timing is inherently flaky: the 150 ms slide is now awaited in `visual.e2e.ts`, which removes
the timing dependency for the guard.
