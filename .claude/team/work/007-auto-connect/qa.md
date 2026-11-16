# 007 auto-connect: QA matrix

Tester: qa agent, 2026-11-16. Build: `npx tauri build --debug --no-bundle` from the uncommitted working
tree (rebuilt at the start of this pass). Device: TI SA430 (USB 2047:0005, serial 08FF41E50F8B3A34) on
`/dev/ttyACM0`, root:dialout, not writable by the test user, so no unplug or USB reset is possible
without root.

Isolation: every app run used a fresh `XDG_CONFIG_HOME` created by the wdio harness (`e2e/wdio.conf.ts`,
under `/tmp`, removed at exit). Logs: `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/3a5c425b-55b3-4603-bc54-2e986edddb21/scratchpad/logs/`.
RUST_LOG=`spectrum_core=debug,spectrum_driver_sa430=debug,info` for every app run.

Probes (temporary WebDriver specs, not part of the suite): `e2e/specs/qa-autoconnect.e2e.ts`,
`qa-autoconnect-sim.e2e.ts` (seed `e2e/fixtures/seed/qa-autoconnect-sim/`), `qa-replug.e2e.ts`,
`qa-sim-replug.e2e.ts`, `qa-launch-settle.e2e.ts`, `qa-failure.e2e.ts`, `qa-visual.e2e.ts`. These are
untracked files in the working tree and must be removed (or turned into real specs) before commit; see
"Housekeeping" below.

Re-enumeration source: `sa430` CLI from `~/workspace/sa430/target/debug/sa430` (prebuilt, not modified).
`sa430 reboot /dev/ttyACM0` is the only non-root way to make the device drop and re-appear on USB.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run check` | PASS, exit 0 | Full log `/tmp/claude-1000/qa-check.log`. Rust: spectrum-core 98 unit, 27 autoconnect, 8 probe, 16 remember, 25 session; sa430 29 unit, 3 autoconnect, 12 session (1 ignored hardware). Vitest, ESLint, tsc, Prettier, clippy `-D warnings`, fmt all green. |
| `cargo test --workspace` | PASS | Included in the check above (`test result: ok` for every target). |
| Bindings | PASS, no diff | `git status -- src/bindings` is empty after `npm run check` (which regenerates them). |
| Threaded autoconnect tests, repeated | PASS | spectrum-core `autoconnect` 27 tests x 5 default runs plus 20 combined runs of core and sa430 autoconnect; 10 runs with `--test-threads=16`. 0 failures. |
| Ignored hardware tests | NOT-RUN here | `crates/spectrum-driver-sa430/tests/hardware.rs` needs `SPECTRUM_E2E_SA430=1`. The `reboot_then_connect_*` cases were run by the developer (dev-T3.md); I did not run them. |
| `npm run e2e` (full suite) | NOT-RUN | Not run in this pass. See "Regression risk" below. |

## Criteria matrix

| # | Criterion (story.md) | Status | Evidence |
| --- | --- | --- | --- |
| AC1 | Launch with SA430 and nothing connected: auto-connects, button shows device, paused (no Play) | PASS | Probe `qa-autoconnect`, test 1, run 2: log `source connected driver=sa430` then `auto-connected device=SA430 08FF41E50F8B3A34` (08:04:29.7). Button `Source: SA430 08FF41E50F8B3A34, Connected`, acquire `data-state=idle`, no `session-notice`, still paused after 3 s. Screenshot `screenshots/qa-launch-1440-sa430-paused.png`: button shows green circle + name; status bar "No data yet, press Play". Looked at it: OK. |
| AC2 | Running app, no source, SA430 plugged in: connects within a few seconds, reusing the work-004 path | PARTIAL | Physical plug-in: NOT-TESTED, for the human. Re-enumeration proxy (`sa430 reboot` while disconnected = udev remove + add): PASS. Probe `qa-replug`, 2 cycles: auto-connected 1290 ms and 1197 ms after the reboot command returned, paused, no notice. Log `auto-connected` after each `source disconnected`. Screenshots `qa-replug-cycle1-1440-sa430-auto-connected-paused.png`, `qa-replug-cycle2-...` (identical to AC1 screen). Launch-while-settling variant (`qa-launch-settle`): launch scan logged `no device found at launch` 0.2 s after the reboot, and the device was connected by the Added event 0.7 s later (`auto-connected` 37.06). |
| AC3 | Two devices at launch: first discovered connected, other stays in menu | PARTIAL | Only one SA430 available. Core test `launch_connects_the_first_device_paused_and_remembers_it` uses two fake devices (a, b) and asserts `a` is connected. The "other stays in menu" part is not asserted in that test and was not checked on hardware. |
| AC4 | Source already connected (simulator or hardware), device plugged in: nothing changes | PASS (real device for simulator case) | Probe `qa-sim-replug`: simulator selected and Acquiring (frame 62), then `sa430 reboot` (device re-enumerated, the app does not hold the port). For 10 s after: source stayed `Signal simulator`, state `Acquiring` on every sample, frame count kept rising (62 to 365), no `session-notice`. Screenshot `screenshots/qa-sim-plugin-1440-simulator-acquiring.png`: OK (Center, span, LIVE badge, status bar match the simulator). Core tests `added_while_a_source_is_connected_changes_nothing`, `added_while_the_simulator_is_connected_changes_nothing`, `a_manual_connect_during_an_auto_attempt_is_never_replaced`. Hardware-connected case (SA430 already connected, second device plugged): not testable with one device, NOT-TESTED. |
| AC5 | Unplug of the connected device: prompt disconnect, no crash/hang; replug auto-connects paused | PARTIAL | Physical unplug while paused or acquiring: NOT-TESTED, for the human (see below). Could not be simulated: `sa430 reboot` needs the port, and the app holds it exclusively (`Device or resource busy`, probe `qa-replug`, app connected, Connected state unchanged 3 s later, no notice). No non-root USB reset or deauthorise (device node root:root 664, `authorized` root-owned). Core/driver tests `removed_while_paused_disconnects_with_device_lost`, `device_removed_while_acquiring_disconnects`, `unplugging_the_connected_analyzer_disconnects_with_device_lost`. Replug part: PASS (AC2). |
| AC6a | Manual disconnect: no auto-reconnect on its own (wait >= 10 s) | PASS | Probe `qa-autoconnect` test 2: `source disconnected` (DEBUG, 08:04:33.67) then 12 s of samples at 0.5 s: all `Disconnected`. Log has no `auto-connected` line until the next app start. Screenshot `screenshots/qa-manual-disconnect-1440-sa430-after-12s.png`: grey circle, "No source connected" badge, status "No source connected.": OK. Core test `manual_disconnect_stays_disconnected_until_the_next_added`. |
| AC6b | Failed auto-connect: no retry by itself; next attempt only on next plug-in or launch; same honest error | PASS | Probe `qa-failure`: a QA-started python process held `/dev/ttyACM0` with TIOCEXCL, then the app was relaunched. Log: one `could not connect source` WARN, one `auto-connect failed` WARN (08:07:22.15), no second attempt in the following 15 s (state Disconnected, notice text unchanged). Notice: "Could not connect to TI SA430 spectrum analyzer: Could not open /dev/ttyACM0: serial port error: Device or resource busy. Check that the analyzer is connected and the port name is right." with Reconnect and x. Screenshot `screenshots/qa-failed-autoconnect-1440-notice.png`: text fits on one line at 1440, Reconnect and x visible: OK. After the holder was killed, `sa430 reboot` (plug-in event) auto-connected 0.9 s later (`auto-connected` 08:07:39.56), paused, no notice (`screenshots/qa-after-failed-replug-1440-sa430-paused.png`). Caveat: I did not capture the same failure from a manual connect for a side-by-side comparison; the text comes from the same `SessionManager::connect` ConnectFailed path. Core test `a_failed_connect_is_reported_once_and_a_later_plug_in_connects`. |
| AC7a | Simulator never auto-connected | PASS | Probe `qa-autoconnect-sim`: seed has the simulator remembered and `lastSourceId` = simulator, SA430 present. Result: `auto-connected device=SA430`, the button shows the SA430 and never the simulator over 2 s. Screenshot `screenshots/qa-sim-remembered-1440-sa430-paused.png`: OK. Core test `launch_with_no_device_or_only_the_simulator_does_nothing`. |
| AC7b | With no hardware present, launch behaves as today | NOT-TESTED | This machine always has the SA430 attached, and discovery cannot be hidden without root. Covered by core tests (`launch_with_no_device_or_only_the_simulator_does_nothing`, `without_a_watchable_driver_nothing_is_watched_and_the_simulator_is_not_picked`). Needs a run on a machine without the device, or the e2e suite. |
| AC8 | Auto-connected device remembered like a manual connect (ADR 0009) | PASS | Probe `qa-autoconnect` test 3: `preferences.json` `lastSourceId` written with the new entry id (`src-…`), one entry in `sources.json`. Relaunch: the stored centre 434.500000 MHz (set before the manual disconnect) was applied (`screenshots/qa-relaunch-1440-sa430-remembered-paused.png`: Center 434.500000 MHz, paused, Stopped badge). Core tests `launch_remembers_with_stored_settings_applied`, `launch_with_stale_stored_settings_falls_back_to_defaults`, `launch_connects_the_first_device_paused_and_remembers_it`. |
| AC9 | Device specifics stay in the driver; core/session/UI see a generic capability | PASS (read-only review) | `crates/spectrum-core/src/autoconnect.rs` names no device or port (read in full for the event paths). SA430 port/udev code is in `crates/spectrum-driver-sa430/src/lib.rs` (`watch`, `Event` mapping). Review by staff engineer approved the boundary (review-T1-T2.md). |
| AC10 | Tests: fake-watcher core/session tests; SA430 driver tests; `npm run check` green | PASS | 27 core autoconnect tests, 3 sa430 autoconnect tests, session tests; `npm run check` exit 0. The e2e/scripted launch check is provided by the temporary probes above, not committed. |
| NFR | UI and Play/Stop stay responsive during launch auto-connect | PARTIAL | Probe `qa-autoconnect` test 4: IPC-backed reads max 57 ms while connected and with Play toggled (Acquiring and back to Connected). Probe `qa-launch-settle`: UI showed Connected 47 ms after UI ready, max read 47 ms. The auto-connect itself took only milliseconds on this hardware, so a Play press could not be placed inside the connect window; the lock-holding risk the staff engineer flagged (review should-fix) was NOT exercised. |
| NFR | Simulator/dBFS vs dBm labels | PASS | SA430 status bar shows calibrated dBm ("Unit" dBm, no "Uncalibrated"); simulator status shows dBFS and "Uncalibrated" (`qa-sim-plugin` screenshot). Axis "dBm" for the SA430, "dBFS" for the simulator. |

## Visual inspection

Screenshots in `screenshots/` (1440 wide, the window's design width). Each was opened with the Read tool.

| File | State | Finding |
| --- | --- | --- |
| `qa-launch-1440-sa430-paused.png` | auto-connected, paused, real SA430 | ok. Button name `SA430 08FF41E50F8B3A34` fully visible with its ▾; zoomed toolbar crop shows no clipping. |
| `qa-launch-settle-1440-sa430-connected.png` | launch right after reboot | ok (same screen as above). |
| `qa-relaunch-1440-sa430-remembered-paused.png` | relaunch, remembered entry, stored centre | ok. Centre 434.500000 MHz restored. |
| `qa-manual-disconnect-1440-sa430-after-12s.png` | after manual disconnect | ok. Grey circle, "No source connected" badge. Centre shows "0 Hz" and span "—" while disconnected (pre-existing, not from 007). |
| `qa-sim-remembered-1440-sa430-paused.png` | simulator remembered, SA430 auto-connected | ok. |
| `qa-sim-plugin-1440-simulator-acquiring.png` | simulator acquiring after SA430 re-enumeration | ok. |
| `qa-failed-autoconnect-1440-notice.png` | failed auto-connect at launch | ok. The notice fits on one line; Reconnect and x are visible and not clipped. |
| `qa-after-failed-replug-1440-sa430-paused.png` | auto-connected after a failed attempt | ok. |
| `qa-replug-cycle1/2-...png` | auto-connected after reboot | ok. |

Pending screenshots (probe `qa-visual`, written but not yet run when this file was saved; see status
line below): `qa-menu-1440-sa430-auto-connected-remembered.png`, `qa-long-name-1440-...`,
`qa-long-name-1024-...`, `qa-focus-1440-source-button-keyboard.png`. Their result is NOT-TESTED (see "Not finished in this pass").

Visual observation, not caused by 007 (for PM, low): the source button shows the connection state
only as a coloured circle (green = connected, grey = disconnected). The words "Connected" or
"Disconnected" are only in the accessible name (`aria-label`). This follows design 001 (state on the
button is the circle). The Play button enablement and the status bar text carry the rest.

## Bugs

No defect in the auto-connect behaviour was found. The only findings are the observation above and the
regression risk below. No `bug` message posted for this pass unless listed under "Filed".

## Regression risk (not verified)

- Existing SA430 hardware specs (`e2e/specs/sa430.e2e.ts`) assume the app never connects by itself
  (its comment before "restores the retuned centre frequency after a restart"). With auto-connect they
  may still pass (the spec picks the row, which reconnects), but this was not run. The full e2e suite
  on a machine with an SA430 attached may also see an auto-connected source at the start of specs that
  expect Disconnected. NOT-RUN; a follow-up run of `npm run e2e` is needed before the feature is accepted.

## For the human (only a physical action proves these)

1. Plug the SA430 into a USB port with the app closed, then start the app: connects paused (AC1 with
   a real plug, not a reboot).
2. With the app running and nothing connected, plug the SA430 in: connects paused within a few seconds.
3. Unplug the SA430 while paused: the notice "SA430 ... was unplugged." appears and the button shows no
   connection promptly; no crash or hang. Replug: auto-connects paused.
4. Unplug while acquiring (Play pressed): the trace stops with the same notice; replug connects paused,
   acquisition not restarted.
5. Two SA430s plugged in at launch: the first one found is connected, the other is listed in the menu.
6. Pressing Play or Pause within a few seconds of the launch auto-connect: the window must not freeze.
   Not reproducible here because the launch connect took milliseconds.

## Not finished in this pass

- `qa-visual` probe: first run took the menu screenshot, then failed because my 63-char test name was
  over the 60-char limit (probe error, not a product defect: the dialog kept open). The name was fixed to
  exactly 60 chars and the probe was rerun, but the shell then became unavailable (tool-permission
  classifier errors), so the rerun is NOT-TESTED. Not verified: 60-char name on the toolbar at 1440, the
  1024-wide toolbar overflow check, keyboard focus ring. The design 006 Q8 request (1024 toolbar with
  `SA430 08FF41E50F8B3A34` and a 60-char name) therefore stays open.
- Source menu with the auto-connected remembered row (`qa-menu-1440-sa430-auto-connected-remembered.png`,
  read with the Read tool): ok. "Your sources" row `SA430 08FF41E50F8B3A34`, "Connected · /dev/ttyACM0",
  USB badge; simulator row and Add source/Disconnect present; the device appears once. The "Detected
  devices: No new devices found" text is shown while the same device is connected; the design says a
  remembered device present is listed only under Your sources, so this text is accepted as correct.
- `npm run e2e` full suite: NOT-RUN (see regression risk).
- Bug messages and the report to product-manager: not posted by this pass (msg CLI needs the shell,
  which was unavailable). They must be posted by the next QA run or the caller.

## Housekeeping

- The temporary probes (`e2e/specs/qa-*.e2e.ts` and the seed `e2e/fixtures/seed/qa-autoconnect-sim/`)
  were deleted after the run, so `git status -- e2e` shows no QA files. They need a real SA430 and use
  absolute paths to `~/workspace/sa430`; the recipe is in this file, in the memory notes, and in the
  probe names above.
- No process was left running: the QA holder python process was killed by QA; `fuser /dev/ttyACM0`
  returns "no holder" (exit 1) at the end of the pass.
- Logs: `scratchpad/logs/*.log` (outside the repo).
