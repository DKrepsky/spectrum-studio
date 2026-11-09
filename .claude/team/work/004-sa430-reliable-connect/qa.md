# QA 004 — Reliable SA430 connect

Tested: uncommitted working tree on `main` (driver: `crates/spectrum-driver-sa430`, ADR 0012, docs). Debug app rebuilt with `npx tauri build --debug --no-bundle` before the GUI runs. Device: TI SA430 (serial 08FF41E50F8B3A34) on /dev/ttyACM0. QA did not commit anything.

## Verdict

**Ship, with one caveat**: the physical unplug/replug test (criterion 4, "plug-in then connect") was not done because QA cannot replug. QA simulated it with a device reset (see below). The human must run the real replug test before final acceptance. No defects were found.

## Test matrix

| # | Criterion / area | Method | Result | Evidence |
|---|---|---|---|---|
| 1 | `npm run check` green | `npm run check`, run twice (start and end) | **pass** | exit 0; cargo fmt, clippy -D warnings, `cargo test --workspace` (166 Rust tests passed, 0 failed, 6 ignored hardware tests skipped); Prettier, ESLint, tsc, Vitest (204 passed). Log: `e2e/logs/qa-004/qa-check2.log` |
| 1a | Developer tests assert behaviour | Read `src/lib.rs` test list and `tests/session.rs` | **pass** | Tests assert serial/label/device_id, attempt counts, drop counters (fresh port per attempt), the message text and "never Connected" for persistent failure. Glitch-then-success (`a_glitched_first_handshake_is_retried_on_a_fresh_port`), silent-then-success, three-attempt sequence, session-level glitchy connect and dead device all exist. |
| 2 | Hardware suite (`--ignored`, `SPECTRUM_E2E_SA430=1`) | `cargo test -p spectrum-driver-sa430 --test hardware -- --ignored --test-threads=1 --nocapture` (app not running) | **pass 6/6** | `usb_serial_equals_calibration_serial`, `discovery_is_stable`, `ten_connect_cycles_all_succeed_on_the_first_attempt` (10 x 1 attempt, ~229 ms each), `reboot_then_connect_succeeds_with_the_default_policy` (2 attempts, 380 ms), `reboot_then_connect_without_settle_recovers_within_the_policy` (4 attempts, 1.69 s), `connect_then_sweeps_return_calibrated_traces` (3 sweeps ~111 ms). Log: `e2e/logs/qa-004/qa-hw.log` |
| 3 | Real app: connect from source menu, Connected + live dBm trace, 10 cycles first try | e2e spec `e2e/specs/qa-004-connect.e2e.ts` (`QA004_CYCLES=1`), WebDriver on the debug build | **pass 10/10** | Every cycle: state went `Connecting…` then `Connected` with no notice. Click-to-Connected: 455, 403, 489, 416, 447, 434, 538, 331, 347, 382 ms. Each cycle acquired and showed `dBm` (never `Uncalibrated`), then disconnected to `Disconnected`. Log: `e2e/logs/qa-004/qa-cycles.log` |
| 3s | Screenshot of connected state | WebDriver screenshot at cycles 1 and 10, 1440 px | **ok** | `screenshots/qa-connected-1440-real-cycle1.png`, `screenshots/qa-connected-1440-real-cycle10.png`. Green dot, name `SA430 08FF41E50F8B3A34` (not truncated), LIVE badge, dBm axis, status bar `Unit dBm`. See notes N1 and N2. |
| 4a | Reboot while disconnected, then connect at once (plug-in simulation) | Scratch helper outside the repo (`scratchpad/sa430-reboot`, `sa430 =0.2.0`, calls `Sa430::reboot()`), run from the spec before each connect. The spec waits for /dev/ttyACM0 to vanish and reappear, then clicks the row. 3 repetitions. | **pass 3/3, no user retry** | Port back after 661–667 ms. Connect from menu 395, 499, 406 ms (1.07–1.21 s after the port was back, because of the WebDriver menu click). States `Connecting…` then `Connected`; no failure notice. Log: `e2e/logs/qa-004/qa-plugin.log`. Attempt count inside the app is not visible; the driver-level test shows the first try can fail with a retry (2 attempts). |
| 4b | Connecting state visible during retries; no false Connected | Sampled `sessionState()` every ~10 ms during each connect | **partial** | `Connecting…` was seen in every connect, for 80–230 ms. `Connected` was never shown before the calibration read succeeded. The UI never reached a retry-only window in the app, because the device did not fail in the app runs. The retry UI path is therefore only covered at the driver level (ADR 0012 hardware measurements). |
| 4c | Real replug (unplug, wait, plug, connect) | **Not run — QA cannot physically replug. Human test required.** | not-run | — |
| 5a | Non-SA430 port, silent (pty nobody answers) | socat pty pair, Add source → Test connection (`QA004_NEGATIVE=1`) | **pass** | 4364 ms, message: "/tmp/claude-1000/qa004-silent did not answer like an SA430 (I/O error: Operation timed out). Unplug and reconnect the analyzer, then try again." Screenshot: `screenshots/qa-negative-silent-1440.png` (inside the dialog, red result box, no clipping). |
| 5b | Non-SA430 port, echoes bytes (pty with `cat`) | same | **pass** | 4327 ms, same message. `screenshots/qa-negative-echo-1440.png` (ok, see N3). |
| 5c | Missing port (`/dev/ttyACM9`) | same | **pass (fast failure, different message)** | 1133 ms: "Could not open /dev/ttyACM9: serial port error: No such file or directory. Check that the analyzer is connected and the port name is right." The QA assertion expected the SA430 message, so my test case failed as written. This is the open-error path, which is the intended message for a missing node. No hang. |
| 6a | Simulator still works | `runSimulator` + acquire, `QA004_SOAK=1` | **pass** | Connected, acquired, LIVE, status shows `dBFS` (simulator is uncalibrated IQ, correct label). |
| 6b | SA430 sweeps for over a minute, no timeout | Connect, acquire, sample every 5 s for 60 s, `QA004_SOAK=1` | **pass** | 12 samples over 62 s, all `Acquiring`, `live`, no notice. Frame counter #65 to #572 (steady ~9.0 fps). Screenshot `screenshots/qa-soak-1440-real-after60s.png`, rendered with waterfall. Log `e2e/logs/qa-004/qa-soak3.log`. |
| 7 | Retries bounded, dead device fails within ~6 s | Negative runs above (4.3 s silent/echo, 1.1 s missing) | **pass** | All under 6 s. |
| 8 | Persisted/UI-only behaviour | not applicable (no UI or persistence change in 004) | n/a | story: no UI change |
| 9 | Regression, other drivers | not run beyond the simulator; other drivers not touched by the diff (`git diff --stat` only in `spectrum-driver-sa430`, docs, Cargo.lock) | not-run | — |

## Screenshots reviewed (Read tool)

| File | Finding |
| --- | --- |
| `screenshots/qa-connected-1440-real-cycle1.png` | ok. Connected, LIVE, dBm axis, no clipping in the source button. N1 and N2 apply. |
| `screenshots/qa-connected-1440-real-cycle10.png` | ok. Same as cycle 1. Status bar shows `Rate 0.0 fps` at that single sample (see N2). |
| `screenshots/qa-soak-1440-real-after60s.png` | ok. Waterfall fills, LIVE, `Rate 9.0 fps`, frame #572. |
| `screenshots/qa-negative-silent-1440.png` | ok. Error text fits in the red box, wraps cleanly, Cancel/Save inside the dialog. Message wording as in criterion 5a. |
| `screenshots/qa-negative-echo-1440.png` | ok. Same dialog and layout as the silent case, message as in criterion 5b. |

Window width was 1440 px (the default window), not the 1024 px minimum. Narrow-window and 60-char name checks belong to the visual suite, not to this story.

## Notes (no bug filed)

- N1. Center field shows `433.920000 MHz` while the status bar shows `Center 433.919 MHz`. Likely the analyzer snapping the centre to its step. Not caused by 004 (no UI or `spectrum-core` change). Minor; for PM to decide whether it is already known.
- N2. One status sample during cycle 10 showed `Rate 0.0 fps` with a moving frame counter. Soak over 60 s shows steady 9 fps, so this is a sampling artefact of the first seconds, not a stall. Not reproduced as a defect.
- N3. The user-facing failure text includes the raw cause "(I/O error: Operation timed out)". It is the same style as the original report, so the copy is unchanged. Only mention it if copy is reviewed later.
- N4. Missing-port failure (criterion 5c) gives the open-error text, not the "did not answer like an SA430" text. This matches the design in ADR 0012 and the review.
- N5. The 200 ms settle and the reboot-based reproduction are approximations of a physical plug (USB power-up). Only the human replug test confirms the fix fully.

## Open items for the human

1. Physical replug: unplug the SA430, wait a few seconds, plug it in, then pick it in the source menu once. It must connect first try (no "No frame start", no timeout, no second attempt). Repeat 3 times if possible.
2. Confirm the message wording (N3) is acceptable.

## Files

- Spec (QA-owned, untracked, gated by env vars, not part of the product): `e2e/specs/qa-004-connect.e2e.ts`. Run with `SPECTRUM_E2E_SA430=1` and `QA004_CYCLES=1` / `QA004_PLUGIN=1 SA430_REBOOT_BIN=<helper>` / `QA004_NEGATIVE=1` / `QA004_SOAK=1`.
- Logs: `e2e/logs/qa-004/`.
- Screenshots: `.claude/team/work/004-sa430-reliable-connect/screenshots/`.
- Scratch reboot helper (not in the repo): `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/f510613e-e5f6-408e-b8bd-c680298d518f/scratchpad/sa430-reboot/`.

## Bugs

None filed. No defect was reproduced against the acceptance criteria.
