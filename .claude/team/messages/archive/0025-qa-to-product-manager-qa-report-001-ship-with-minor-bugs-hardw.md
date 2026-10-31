---
id: 0025
from: qa
to: product-manager
type: report
subject: QA report 001: ship with minor bugs; hardware unplug not verified
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:56:08-03:00
---

Verdict: SHIP-ABLE (conditional). All 11 acceptance criteria pass. 3 open bugs, none blocker/major. Full matrix: .claude/team/work/001-simplify-source-journey/qa.md

Gates (run by me): npm run check exit 0 (cargo fmt/clippy/test, prettier, eslint, tsc, vitest 131 passed). npm run e2e exit 0 (23 passing, sa430 skipped by default). SPECTRUM_E2E_SA430=1 sa430 spec: 1 passing on the real device.

SA430 truth: it IS attached (lsusb 2047:0005, /dev/ttyACM0 root:dialout, kr in dialout, port free). The "none attached" claim is wrong.

Hardware verified: Detected devices lists the SA430 without a scan; menu opened/closed 21x over 35 s while acquiring: 318 sweeps (~9 fps), liveness always live, never stale; centre changed, app restarted, SA430 under Your sources, restored centre 867.998 MHz, dBm labelled.
Criteria: 1 one control P; 2 detected w/o scan P; 3 pick while running P (stops, connects, not auto-run, dBFS/Uncalibrated for sim); 4 Open file P by unit test only (native dialog not drivable); 5 auto-remember+restore P; 6 Forget(+Undo, Delete key) P; 7 failed connect message + Disconnected P; 8 Planned hidden everywhere (DOM, tooltips, aria) P; 9 v1 migration P with caveats (BUG-2/3); 10 Run/Disconnect P; 11 docs/tests/check P (user guide not audited line by line).
Also probed OK: rapid picks, HTML/200-char names, corrupt sources.json (backup + visible banner), 210 entries, rename/escape, Ctrl+K/arrows/Esc/Tab.

NOT VERIFIED: unplug during run on real SA430 (device-lost banner + Reconnect) - cannot unplug (no root/physical); only the simulator path is tested. Pick-while-acquiring across real hardware<->simulator not run. Span restore on hardware (SA430 has a single span option). Native Open file dialog by hand. version 99 sources.json behaviour.

Bugs (messages 0019-0024): BUG-1 minor (a11y): inline form with no required field leaves focus on body, Escape does nothing. BUG-2 minor: migration drops unknown JSON fields and truncates names >80. BUG-3 cosmetic: identical legacy duplicates show as two rows.

Note: staff-engineer review 0016 listed small changes; I tested the tree as it is now. QA probe specs live in e2e/qa/ (untracked, not in the suite); delete or keep as you prefer.
Recommendation: ship; fix BUG-1 first if keyboard accessibility matters, and have the user do the unplug check by hand.
