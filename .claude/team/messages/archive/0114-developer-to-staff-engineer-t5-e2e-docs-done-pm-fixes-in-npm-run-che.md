---
id: 0114
from: developer
to: staff-engineer
type: handoff
subject: T5 e2e + docs done, PM fixes in, npm run check green, E2E results
work: 006-capture-modes
reply-to: 
date: 2026-11-09T21:58:58-03:00
---

T5 (e2e, docs) and the two PM items (0111 failure announcement, 0113 extras) are done. Uncommitted. `npm run check` EXIT 0 on the final tree: cargo fmt, clippy -D warnings, 183 Rust tests, Vitest 247/247 (25 files), eslint, tsc app+e2e.

Files
- Small fix (0111): src/components/capture/CaptureControl.tsx (no "failed" in the live region; complete/cancelled kept) and its test (failed case now asserts silence; live-region assertions tightened to `textContent === ''`).
- 0113: stop() now returns the command result (src/state/session.ts, `stop: () => Promise<boolean>`); CaptureControl resets the cancelled flag when Stop fails, so the sweep is announced as complete (new test "announces complete, not cancelled, when the Stop itself failed").
- e2e: helpers.ts (captureMode, chooseMode, frameSeq); acquisition.e2e.ts (SIMULATED expectations removed, new labels, menu keyboard, Single switch, one-sweep auto-stop checked by frame seq +1 and no further frames, second press, mode locked while acquiring); persistence.e2e.ts (Single saved and restored after restart, Continuous saved after a second restart; the restore step runs in Single); sa430.e2e.ts (badge check removed, new hardware test "captures one real sweep in Single mode and stops by itself"; fixed a pre-existing defect in "restores the retuned centre frequency": it pressed Play while disconnected, see below); visual.e2e.ts (new test: capture control keeps its width/height across modes, menu inside the window, assertNoOverflow on the popover; comment at ~550 updated; test title no longer says "no badge").
- Docs: docs/sources.md (capture modes paragraph), docs/architecture.md (capture mode in the session), docs/roadmap.md (006 row "In QA"; new Known limitations: SA430 single cancel latency, and the E2E failures below), docs/testing.md (e2e row, WebKitWebDriver without root), docs/user-guide.md (SIMULATED and Play/Pause text replaced, per 0113), docs/adr/0005 (note: badge superseded by 0013). story.md status = qa.

E2E (npm run e2e, debug build of the final tree, WebKitWebDriver from apt download, no root)
- acquisition PASS (15), add-source PASS, edit-source PASS, failures PASS, migration-dup PASS, migration PASS, persistence PASS (5), sa430 PASS (skipped without SPECTRUM_E2E_SA430), source-row 9 pass / 1 FAIL, visual 19 pass / 4 FAIL.
- Visual and source-row failures are pre-existing: I built the HEAD export (git archive HEAD, scratch dir) and ran visual + source-row against it. Same 5 failures with the same messages: hover actions under the badge (known defect, roadmap), three "source button never showed Bench SA430 analyzer 2" cases (menu stays open after a failing pick), and source-row "Edit is not focus-within its row". Not fixed here (out of scope); noted in roadmap Known limitations. Your decision needed: fix or mark skipped.
- sa430 with real SA430 on /dev/ttyACM0, SPECTRUM_E2E_SA430=1: 6/6 PASS (detect, add with Test connection, rename + restart, live dBm sweeps, single sweep, restore centre after restart). Only the sa430 spec ran with hardware; add-source hardware cases and the visual hardware cases were not run.
- Pre-existing defect fixed in sa430.e2e.ts: the restore test pressed Play right after a restart while disconnected (Play is disabled until connected, and the app never auto-connects). Now it picks the remembered row first.
- Screenshots: e2e/logs/visual/capture-{continuous-idle,single-idle,menu-open}-{1024,1180}.png (WebDriver, real WebKitGTK). Not yet looked at by me in detail; QA to review.

WebKitWebDriver (for QA to reuse)
- Extracted to: /tmp/claude-1000/-home-kr-workspace-spectrum-kit/a640f3fc-2223-4a00-85a4-79b77b8f32a1/scratchpad/webkit/root/usr/bin/WebKitWebDriver (package in .../scratchpad/webkit/deb). Use `PATH=<that dir>:$PATH npm run e2e`.

Flake to watch
- crates/spectrum-driver-sa430/tests/session.rs "unplugging_the_analyzer_disconnects_the_session" failed once during parallel load (npm run check ran while the E2E build and specs ran: state stayed Connected with "did not answer in time"). Not reproduced in 6 further runs (3 standalone binary runs, 3 full-check runs). No driver or worker change in this work touches that path for continuous mode. Worth a look by the staff engineer.

Deviations from T5: docs/user-guide.md, docs/testing.md and ADR 0005 were touched beyond the task's list (stale SIMULATED/Play text; helper names; per 0113). The single capture cannot be observed in CAPTURING on the simulator (near-instant), as the plan says; the e2e checks the end state and frame count.
Not done: git commit (not asked); visual QA of the new states (QA).
Messages: 0111 and 0113 archived.
