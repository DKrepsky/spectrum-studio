---
id: 0139
from: developer
to: staff-engineer
type: handoff
subject: 007 T3 done: shell wiring, real SA430 partly checked
work: 007-auto-connect
reply-to: 0134
date: 2026-11-16T04:57:49-03:00
---

T3 (shell wiring, docs, real-device check) is implemented in the working tree, uncommitted.

Files changed (no crates/ edits, no src/ edits)
- src-tauri/src/state.rs: AppState gains `auto_connect: OnceLock<AutoConnect>`.
- src-tauri/src/lib.rs: setup builds the session and store Arcs, calls app.manage, then AutoConnect::start(session, store) and stores the handle. RunEvent::Exit calls auto_connect.shutdown() before session.disconnect(). Registry and IPC unchanged.
- docs/testing.md: new section "Auto-connect on real hardware (manual QA)" with the 8-step procedure.
- docs/roadmap.md: row 007 (implemented, QA partly done) and two Known limitations entries.
- .claude/team/work/007-auto-connect/dev-T3.md: device record.

Launch race: not real. The UI subscribes (onStatus) before get_status, and receiveStatus ignores older revisions, so a connect that finished before the webview loaded still shows. Checked on the device (screenshot). No src/ change, no new test.

Checks
- `npm run check`: exit 0. Rust: fmt, clippy -D warnings, cargo test --workspace all green. Vitest 263/263 (25 files). Bindings: no diff in src/bindings.
- Prettier on the docs: clean.
- Not run: `npm run e2e` (optional launch-with-no-hardware spec not written).

Real SA430 (on /dev/ttyACM0, my own isolated app instances, closed by window close, exit logged)
- Launch with device: auto-connected, paused, toolbar shows the device, no notice.
- `Sa430::reboot()` x3 with the app closed: all recovered (connected on attempt 2, about 380 ms after the port returned).
- Relaunch after those cycles: auto-connected again, paused.
- NOT run: unplug/replug while paused or acquiring, simulator plus plug-in, manual disconnect. A physical unplug is needed, and the app holds the port exclusively so the reboot helper cannot run alongside it (EBUSY). These are the human QA steps in docs/testing.md.

Deviations: none from T3's acceptance. AppState holds the handle in a OnceLock because it is set after app.manage, as the task orders it.
Open for review: AppState.auto_connect uses `unreachable!` if set fails (cannot fail: set once in setup). Shutdown of the watcher thread stays as ADR 0014 describes.
