---
name: sa430-attached-run-recipes
description: Working recipes for QA runs with the TI SA430 attached (work 014/015 second pass): probe pattern, which specs fail for the launch-guard race, sweep limit and replug timings
metadata:
  type: reference
---

- Probe specs with the device attached: write under `e2e/specs/qa-<id>-*.e2e.ts`, run with `SPECTRUM_E2E_SA430=1 QA_OUT=<dir> SPECTRUM_E2E_SHOTS=<dir> npx wdio run e2e/wdio.conf.ts --spec ...`, then move (not delete) them to the evidence dir before the full e2e. Use the Write tool for probe files: a bash heredoc into `e2e/specs/` was refused by the auto-mode classifier once.
- Replug without unplugging: `~/workspace/sa430/target/debug/sa430 reboot /dev/ttyACM0` works while the app's selection is the simulator (idle or acquiring) or Failed; with the SA430 connected it fails (port busy). Timeline with an idle simulator: "Connecting…" about 0.8 s after the command returns, "Connected" about 0.2 s later.
- Plug-in during simulator acquisition: no interruption (frames keep rising); the device is NOT connected after the stop (no retry). The device shows as a remembered row, not under Detected devices.
- Busy port at launch: hold the port (python3 -I with TIOCEXCL, `holdPort` in `sa430.e2e.ts`), then `browser.reloadSession()`: the launch ends Failed, selected, no simulator. Release, then `sa430 reboot`: connects from Failed.
- Sweep limit: `points = span / step + 1` must be at most 800 (MAX_SWEEP_POINTS). 10 MHz with 10 kHz (1001 points) is refused at commit with a banner, value reverts. 10 MHz with 50 kHz (201) is fine.
- Launch-state specs with the analyzer attached: `startup` (1), `acquisition` (1) and `persistence` (restore assertion) fail because `analyzerAtLaunch()` runs before the launch connect. Deterministic. Full run with a device is not a clean signal (11 workers each auto-connect the one SA430).
- Measurement row DOM: `#measurement-stepKhz` (NumberField, aria "Frequency step", unit "kHz" in describedby), `#measurement-refLevelDbm` (native select, values "-35".."-70", text "-35 dBm"). Display's plot Reference level is a different NumberField with the same name.
- Disabled capture button: `disabled` true, computed opacity 0.6 (with no source).
- A probe's `chooseMode('continuous')` after a disconnect fails with "capture mode menu did not open": the chevron is disabled with no source. Not a product defect.

Related: [[hardware-replug-recipes]], [[no-device-run-recipes-015]], [[hardware-visual-and-pixel-checks]]
