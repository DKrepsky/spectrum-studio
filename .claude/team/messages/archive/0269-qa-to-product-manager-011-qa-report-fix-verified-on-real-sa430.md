---
id: 0269
from: qa
to: product-manager
type: report
subject: 011 QA report: fix verified on real SA430 (simulated sequence); e2e red from 2 pre-existing acquisition tests; physical test pending
work: 011
reply-to: 
date: 2026-11-17T02:57:22-03:00
---

Verdict: the 011 fix works on the real SA430 for the simulated sequence and for a genuine failed connect. Ready for the human's physical unplug/replug test. Not "done" until the human confirms it; C4 (e2e) is red for reasons unrelated to this change (BUG-011-QA-1).

Per criterion (full matrix and evidence: .claude/team/work/011-reconnect-after-failed-retry/qa.md):
- C1 npm run check: PASS. Exit 0 (.claude/team/work/011-reconnect-after-failed-retry/qa-check.log). cargo test workspace all ok (autoconnect 33 incl. R1-R3); Vitest 54 files, 682 tests.
- C2 issue sequence, simulated: PASS. Failed Reconnect (port held by a TIOCEXCL process, so EBUSY), then sa430 reboot (re-enumerate). App auto-connects in about 2.4 s: dot connected, no banner, no stale "Could not open", capture runs (LIVE). Shots 01-06 in .claude/team/work/011-reconnect-after-failed-retry/screenshots/. Pre-fix HEAD on the same steps: Connected but selector Failed, stale error banner, capture running. Shots baseline-HEAD-04/05/06. The bug is reproduced and fixed.
- C3 genuine failed connect: PASS. Failed red X, banner "Could not connect ...", capture disabled, status bar "No source connected.". Shots 03, 07, 08. Disabled capture is visibly dimmed (pixel fill checked).
- C4 e2e with SA430 (SPECTRUM_E2E_SA430=1 npm run e2e): 10 of 11 spec files pass (sa430.e2e 8/8 on the real device, visual 49 passing). acquisition.e2e.ts fails 2 tests, same on HEAD, reproduces alone. Not the known #24 flake. Bug sent (BUG-011-QA-1, major, pre-existing).

Open bugs:
- BUG-011-QA-1 (major, pre-existing): acquisition.e2e.ts "pauses ... marked as held" (text read empty though HOLD badge is visible) and "single capture takes exactly one sweep". Not caused by 011.
- No defect found in the 011 change.

Not simulated (for the human): physical unplug while Connected; physical replug with the cable out (real udev Added with the device absent); plug-in during a Reconnect's retry window with the real device (Rust R2 covers it with a scripted driver only). Human checklist is in qa.md under "Not simulated / for the human".

Residual risk: the simulated failure was an EBUSY (device present, unopenable), not an absent device. The state path is the same, but the physical run is the real proof. Width 1024 not run (no layout change).

Housekeeping: the probe spec was removed from e2e/specs (kept in the scratchpad); no production code changed by QA; new files only in the work folder (qa.md, logs, screenshots).
