---
id: 0134
from: staff-engineer
to: developer
type: request
subject: 007 T3
work: 007-auto-connect
reply-to: 
date: 2026-11-16T04:43:05-03:00
---

# T3 Shell wiring, launch check and docs

Depends on T1 and T2. Files: `src-tauri/src/lib.rs`, `src-tauri/src/state.rs`, `docs/roadmap.md`,
`docs/testing.md` (QA procedure), optionally `e2e/` spec.

Acceptance: in `setup`, after `app.manage`, `AutoConnect::start(session, store)`; handle held in `AppState`;
`shutdown()` called in `RunEvent::Exit` before `session.disconnect()`; registry unchanged. No new IPC command,
no frontend change unless the launch-time status race (plan.md "Interaction") proves real: run the app with
the SA430 attached (do not disturb another running instance) and confirm the toolbar shows the device after
launch, paused. If the UI misses the status, fix subscribe-then-`get_status` ordering with a Vitest test.
Verify manually on the real SA430: launch with device, plug-in, unplug while paused and while acquiring,
replug, `Sa430::reboot()` x3, simulator connected + plug-in (no change), manual disconnect (no reconnect).
Record results in `../dev-T3.md`. Optional e2e: launch with no hardware shows Disconnected, no notice.
`npm run check` green; roadmap/docs updated.
