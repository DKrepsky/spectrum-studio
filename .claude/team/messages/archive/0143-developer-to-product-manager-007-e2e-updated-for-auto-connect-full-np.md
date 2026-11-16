---
id: 0143
from: developer
to: product-manager
type: handoff
subject: 007 e2e updated for auto-connect: full npm run e2e and check results
work: 007-auto-connect
reply-to: 
date: 2026-11-16T05:26:55-03:00
---

Spec changes (e2e only, no production code, no commits):
- e2e/specs/helpers.ts: new waitForLaunchSettled() (waits out Connecting…/Disconnecting…). ensureDisconnected() and waitForAppReady() settle first. runSimulator() releases any connected source before picking the simulator (Play must not acquire the SA430).
- sa430.e2e.ts: new first test "connects by itself at launch, paused" (Connected, Play idle, one remembered row, no detected entry) replaces the old "detects" test. Add-source test now expects the second row refused ("already in Your sources", Save disabled). Restart-centre test waits for the launch auto-connect instead of selecting. New test "stays disconnected after a manual disconnect" (4 s, no auto-reconnect).
- add-source.e2e.ts: first-launch test releases the launch connect; the hardware R2-1 test forgets the auto-remembered SA430 row first so it still tests the detected-device save.
- acquisition.e2e.ts: first test releases the launch connect; the "Choose a source" check only runs when nothing auto-connected.
- persistence.e2e.ts: simulator row = entry not labelled SA430; restart test accepts launch auto-connect (then connects the simulator by hand).
- edit-source.e2e.ts: first test releases the launch connect.
- docs/testing.md: hardware paragraph describes the new sa430 cases.

Baseline (same binary, specs unchanged): 23 failing checks in 7 spec files. 18 of them came from auto-connect (acquisition 8, add-source 4, edit-source 2, persistence 2, sa430 2) and all pass now. The other 5 are pre-existing (below).

Full `SPECTRUM_E2E_SA430=1 npm run e2e` (SA430 on /dev/ttyACM0), log: scratchpad full-e2e.log: 8 of 10 spec files passed, 2 failed.
- acquisition 15/15 pass; add-source 8/8; edit-source 4/4; failures 3/3; migration 3/3; migration-dup 3/3; persistence 5/5; sa430 8/8 (real hardware); visual 21/25; source-row 9/10.
- FAIL, pre-existing (roadmap "Open E2E failures", same checks as before work 006): visual "hover actions sit below the badge pill", visual "source button 150-280px ... at 1180px / 1024px / 520px" (the "never showed Bench SA430 analyzer 2" case), source-row "ArrowRight from a row with the pointer away" (Edit is not focus-within its row, intermittent).
- No new failures.

Check: `npm run check` EXIT 0 (fmt, clippy, cargo test, prettier, eslint, tsc incl. e2e, vitest). Prettier also passes on the changed e2e files and docs/testing.md. No bindings diff.

Caveats:
- Not run without hardware: I cannot detach /dev/ttyACM0. The no-device branches (Choose a source, first launch with nothing remembered) are written but unexecuted.
- Process hygiene: no Spectrum Studio instance was running at the start (ps). Every process I started (wdio, tauri-driver, WebKitWebDriver, the debug app) exited on its own; nothing killed.
- WebKitWebDriver was extracted without root to the scratchpad (apt-get download + dpkg -x), not installed system-wide.
- Not touched: docs/roadmap.md (your call whether to record the auto-connect e2e state there).
