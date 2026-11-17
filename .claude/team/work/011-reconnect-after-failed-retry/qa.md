# 011 QA: reconnect after a failed Reconnect (issue #1)

Tester: qa. Tree: uncommitted working tree (T1 frontend, T2 core), reviewed APPROVE in `review.md`.
Hardware: TI SA430 (2047:0005) on /dev/ttyACM0, attached to this machine throughout.
Scope of this run: everything below was run by QA on this machine. Physical unplug/replug was NOT done
(not possible from QA, see "Not simulated").

## Test matrix (criteria from story.md)

| # | Criterion / case | Evidence | Status |
| --- | --- | --- | --- |
| C1 | `npm run check` green | `qa-check.log` (exit 0) | pass |
| C2a | Failed Reconnect, then plug-in (simulated, see below) reaches Connected, no Failed, no stale error, capture works | probe `e2e/specs/qa-011-reconnect.e2e.ts`, log `qa-011-probe.log`, shots 01-06 | pass (fixed tree) |
| C2b | Same sequence on HEAD (pre-fix) reproduces the bug | shots `baseline-*` (see section below) | see below |
| C3 | Genuine failed connect: selector Failed, status bar, capture disabled agree | shots 03, 07, 08; probe log | pass |
| C4 | `npm run e2e` with SA430 | see section "E2E" | see below |
| R-rust | Rust regression tests R1-R3 run and pass | `qa-check.log` lines (autoconnect 33 passed incl. R1-R3) | pass (reviewed: see below) |
| R-ui | Frontend regression tests | `qa-check.log` (Vitest 54 files, 682 tests) | pass (reviewed) |

## Test-quality review of developer tests

- `crates/spectrum-core/tests/autoconnect.rs`: R1 asserts state, the device, `last_notice` is None and
  the exact open count (3). R2 uses gates (channels) so the plug-in is proven to reach its scan while the
  manual open is still parked; asserts Connected on device `a`, open count 2. R3 asserts the manual device
  `b` stays and only one open happened. These assert behaviour, not just that code runs.
- `src/state/session.test.ts`: the issue sequence asserts failed/commandError/commandErrorFrom cleared and
  status state. The "real order" test drives connecting then disconnected inside the mock, so the
  "failure keeps Failed" path is covered. Out-of-order revision test asserts nothing cleared.
- `status.test.ts`, `SourceButton.test.tsx`: assert the rendered `data-status` and accessible name.
- Not covered by any automated test: the whole path through real IPC and the real driver (covered only by
  this QA run).

## Visual inspection (real app, SA430, 1440x900)

Screenshots: `screenshots/`. Width 1440 only; the narrow 1024 case was not part of this run (not
requested for this fix; the UI change is a state change, not a layout change).

- 01-connected-1440-sa430.png: launch auto-connect, Connected, dot green, Continuous enabled. ok.
- 02-disconnected-1440-sa430.png: after manual disconnect, grey dot, "Disconnected", Continuous dimmed
  (pixel fill 44,145,124 vs 62,224,181 enabled, i.e. unavailable opacity), no banner. ok.
- 03-failed-reconnect-1440-sa430.png: failed Reconnect (port held, EBUSY). Selector red X, banner
  "Could not connect to TI SA430 ... Reconnect", status bar "No source connected.", Continuous dimmed
  (disabled). Selector, status bar and capture agree. ok.
- 04-after-replug-connected-1440-sa430.png: after plug-in auto-connect, green dot, no red X, no banner,
  no command error, Continuous enabled. ok.
- 05-after-replug-menu-1440-sa430.png: Your sources row "Connected · /dev/ttyACM0", no Failed. ok.
- 06-acquiring-1440-sa430.png: Continuous running, LIVE badge, dBm trace after plug-in. ok.
- 07-genuine-failed-1440-sa430.png: genuine failed connect (port held again). Failed red X, banner,
  capture dimmed/disabled. ok.
- 08-genuine-failed-menu-1440-sa430.png: menu row "Failed · /dev/ttyACM0" with red X; "Signal simulator"
  and "Add source…" present, no duplicate rows. ok.
- Note (not a defect): in 03/07 the banner message and the status bar say the same thing as the menu. No
  duplicate row for the one device.

## Simulation performed (criterion 2)

Sequence run by `e2e/specs/qa-011-reconnect.e2e.ts` (temporary probe, to be removed before report):
1. Launch: auto-connect of the SA430 (Connected).
2. UI Disconnect (device stays present).
3. Holder process (`hold-port.py`, a non-root python with TIOCEXCL on /dev/ttyACM0) makes the app's
   Reconnect fail: "Could not open /dev/ttyACM0: serial port error: Device or resource busy" (Failed).
4. Holder killed; `sa430 reboot /dev/ttyACM0` re-enumerates the device (udev remove + add) = plug-in.
   The app auto-connects within ~2.4 s with no user action: Connected, no Failed, no banner.
5. Capture: Continuous, LIVE, frames arrive.
6. Holder again: genuine failed connect (Failed, capture disabled), then cleanup.

NOT simulated: physical unplug while connected (Removed event from a real cable pull), a udev Added
arriving while the app's own Reconnect is still in its retry window (the Rust R2 test covers this with a
scripted driver, not with hardware), and a true "device absent" (the device is present but unopenable
instead). The human must run steps 1-5 of issue #1 with the cable.

## Baseline (HEAD, pre-fix) on the same real SA430 and the same probe

Built from `git archive HEAD` (binary `scratchpad/spectrum-studio-HEAD`), probe unchanged. Log:
`scratchpad/qa-011-HEAD.log`. The bug reproduces on the device:

- After the failed Reconnect and the plug-in: state Connected, capture enabled, but the selector dot is
  Failed (red X) and the banner shows the stale "Could not open /dev/ttyACM0: serial port error: Device or
  resource busy" (`commandError`). Capture then runs (Acquiring, LIVE) with the selector still Failed.
  Shots: `screenshots/baseline-HEAD-04-after-replug-connected-1440-sa430.png`,
  `baseline-HEAD-05-after-replug-menu-1440-sa430.png` (menu row "Failed"), `baseline-HEAD-06-acquiring-1440-sa430.png`.
- With the fix (same steps): dot connected, no banner, no command error, menu "Connected", capture works.

## Results per criterion

| # | Result | Evidence |
| --- | --- | --- |
| C1 `npm run check` | **pass** | `qa-check.log`: exit 0; cargo fmt, clippy -D warnings, `cargo test --workspace` (98 + 33 + 8 + 16 + 25 + 33 + 3 ... all `ok`, 0 failed; `autoconnect` 33 passed incl. R1-R3), Prettier, ESLint, tsc, Vitest 54 files / 682 tests passed |
| C2 issue sequence on real SA430 (simulated, see "Simulation") | **pass** for the simulated sequence; physical unplug **not run** | `qa-011-probe.log` step4: Connected, dot `connected`, commandError null, notice null; shots 01-06 |
| C2 pre-fix reproduction | **confirmed the bug on HEAD** | `qa-011-HEAD.log`, baseline-HEAD-04/05/06 |
| C3 genuine failed connect: selector, status bar, capture agree | **pass** | probe step3 and genuine-failed: dot `failed`, capture disabled, status "No source connected.", notice "Could not connect to TI SA430 ...", shots 03, 07, 08 |
| C4 e2e with SA430 (`SPECTRUM_E2E_SA430=1 npm run e2e`) | **red: 10 of 11 spec files pass; `acquisition.e2e.ts` fails 2 of 15** (pre-existing, same on HEAD) | `qa-e2e-full.log` (Spec Files 10 passed, 1 failed, 00:03:19). sa430.e2e.ts 8/8 passing with the real device, visual.e2e.ts 49 passing. See bug below |
| R-rust | pass (reviewed) | R1, R2, R3 assert state, device, notice, open counts; R2 proves the plug-in reaches its scan while the manual open is parked |
| R-ui | pass (reviewed) | session.test.ts cases: the issue sequence, real order connecting then disconnected, unrelated command error kept, out-of-order status clears nothing; status.test.ts `showsFailed`; SourceButton test: connected not Failed |
| Negative: no hardware edits | ok | `git status`: only the T1/T2 files and tests; probe moved out of `e2e/specs` (kept at scratchpad) |

## e2e detail

- Full run (`qa-e2e-full.log`): 11 workers, parallel. `acquisition.e2e.ts` failed 2 tests:
  1. "pauses: the last trace stays on screen, frozen and marked as held": `expect(plot-liveness).toHaveText('HOLD')`
     received "". The product does show the badge: `e2e/logs/Simulator-acquisition-workflow-pauses-...png`
     shows "HOLD · last data 02:55:43" top right. So the assertion reads an element whose text WebDriver
     returns empty; the UI looks right.
  2. "a single capture takes exactly one sweep and stops by itself": "the single capture did not deliver exactly
     one frame and stop" (`acquisition.e2e.ts` line ~168). Screenshot `e2e/logs/Simulator-acquisition-workflow-a-single-capture-...png`.
- Re-run alone on the working tree: same 2 failures, 13 passing (`qa-e2e-acq-rerun.log`).
- Same spec on the HEAD binary, same 2 failures (`scratchpad/qa-acq-HEAD.log`). So this is not caused by
  the fix. It is deterministic here (not the known flake #24, which is the source-row hover).
- The sa430 spec with the real device passed all 8 tests on this run, no #24 flake this time.

## Bugs

- BUG-011-QA-1 (major, pre-existing, test-suite red on HEAD): `acquisition.e2e.ts` 2 failures above. Owner to triage
  whether the test assertion is wrong (HOLD badge visible but the testid text empty) or a real frame-count regression.
  Reported to product-manager (cc staff-engineer).
- No defect found in the 011 change itself. Visual: no overflow, no clipped text on the 1440 states checked.

## Not simulated / for the human (physical test)

Not done by QA (no way to pull the USB cable from here, no root):
1. Physical unplug while Connected (real Removed event from a cable pull).
2. Physical replug after a Reconnect pressed while the cable is out (real udev Added with the device truly absent).
   The probe used a port holder (EBUSY) and `sa430 reboot` instead, so the failure reason differs from the issue (absent vs
   unopenable). The state path is the same (`connectFailed` notice, `failed` marker, plug-in connects).
3. Plug-in while the app's own Reconnect is still in its retry window (Rust R2 covers this with a scripted driver only).
4. Steps 1-5 of issue #1 with the real cable, to confirm: no Failed dot, no stale banner, capture works.

Human checklist: unplug; wait for "Device lost" banner; press Reconnect (fails: "Could not connect ..."); replug;
expect Connected within a few seconds, no banner, dot green, Continuous enabled.

## Method notes and limits

- Width 1440 only. The 1024 narrow case was not requested for this bug (no layout change); not run.
- Probe spec is removed from `e2e/specs` (it is in `scratchpad/qa-011-reconnect.e2e.ts`) so the suite stays clean.
- `scratchpad/hold-port.py` is the TIOCEXCL holder (non-root). `sa430 reboot` is `~/workspace/sa430/target/debug/sa430`.
