---
id: 0136
from: developer
to: staff-engineer
type: handoff
subject: 007 T1+T2 done: core autoconnect and SA430 watch
work: 007-auto-connect
reply-to: 
date: 2026-11-16T04:53:49-03:00
---

T1 (core) and T2 (SA430 watch) are implemented in the working tree, uncommitted. T3 (shell wiring) is not started.

Check results: `npm run check` exit 0 (cargo fmt, clippy -D warnings, cargo test --workspace, prettier, eslint, tsc, vitest). `cargo clippy --workspace --all-targets -D warnings` clean. `npm run bindings` gives no diff under src/bindings. Threaded tests (core autoconnect, sa430 autoconnect) ran 5 times in a row, all green. I did not run the real app or e2e; no hardware was used.

Files changed
- crates/spectrum-core/src/sources/mod.rs: DeviceEvent {Added, Removed} with location; SourceDriver::supports_watch (default false) and watch(on_event) (default Err unsupported). Not exported to TS.
- crates/spectrum-core/src/sources/registry.rs: watchable() (available and supports_watch).
- crates/spectrum-core/src/session/mod.rs: connect() now delegates to open_locked; connect_if_idle (under worker lock, Ok(None) when a live worker exists, reaps a finished one); connect_if_idle_with_default_fallback; device_removed(driver_id, location) (paused or acquiring; DeviceLost "<label> was unplugged."); watchable_drivers(); shared retry_with_defaults helper.
- crates/spectrum-core/src/remember.rs: auto_connect(session, store, &DeviceDescriptor). Uses the remembered entry with the same identity (stored settings), else a fresh config. Remembers on success like a manual pick (lastSourceId set). Failure remembers nothing.
- crates/spectrum-core/src/autoconnect.rs (new): Policy (launch, on_event, shutdown, is_stopped; all synchronous), AutoConnect::start/shutdown (coordinator thread plus one watcher thread per watchable driver, catch_unwind per step).
- crates/spectrum-core/src/lib.rs: pub mod autoconnect.
- crates/spectrum-core/tests/autoconnect.rs (new): 27 tests (policy, session guards, threads).
- crates/spectrum-driver-sa430/src/lib.rs: Sa430Backend::watch (required; real = sa430::create_monitor()?.run(handler)); Sa430Driver supports_watch = true; watch maps DeviceAdded/Removed to DeviceEvent with location = port name; watch_error -> SourceError::unavailable with cause. Fakes in lib tests updated.
- crates/spectrum-driver-sa430/tests/session.rs, tests/hardware.rs: fake backends gain watch (no-op / delegate).
- crates/spectrum-driver-sa430/tests/autoconnect.rs (new): 3 session tests with the real AutoConnect threads and a scripted backend (plug-in connects paused; unplug -> DeviceLost, re-plug reconnects; failed connect reported once, not retried, next plug-in connects).
- docs/sources.md: watch in the model, auto-connect paragraph in session lifecycle, SA430 hot-plug and test notes.
- docs/architecture.md: auto-connect paragraph. It says the app shell starts and shuts it down; that becomes true with T3.

Tests added: core 27 (launch paused and remembered with stored settings; stale settings fall back to defaults; launch with nothing or only the simulator; scan error; launch failure remembers nothing; Added picks the matching location only; Added while connected or simulator connected changes nothing; unknown or missing location; Added failure is not retried by itself; Removed while paused -> DeviceLost; Removed of another device; Removed then Added reconnects; manual disconnect stays down until the next Added; shutdown; connect_if_idle keeps a connected source and connects when idle; device_removed ignores other drivers and no source; device_removed while acquiring; thread tests: launch plus watched unplug/re-plug, plug-in while nothing connected, failure not retried by itself, watcher error ends its thread and launch still runs, shutdown ends the watcher at its next event and ignores it, manual connect never replaced). SA430 lib 4 (event mapping and order, Break stops, watch error is unavailable with cause, supports_watch). SA430 session 3.

Deviations from the plan (and why)
1. Added DriverRegistry::watchable and SessionManager::watchable_drivers. The watcher threads need the driver objects, and the registry is private.
2. Added connect_if_idle_with_default_fallback so the stored-settings fallback also applies to auto-connect.
3. Policy::launch and on_event return () (tests read the session state). Policy holds Arc clones instead of borrowing, so it can move into the thread.
4. The SA430 session test that covers a failed connect uses a device present at launch (launch fails, then the plug-in connects). The Added-failure path is covered at core level. Reason: a race-free order. The plug-in test waits for the launch scan (scan counter) before it plugs in.
5. The sa430 test store uses a unique directory under std::env::temp_dir() and removes it on drop. The driver crate has no tempfile dev-dependency, and I did not add one.
6. The DeviceLost text is the plan's string, "<label> was unplugged.". The PM's "no new copy" may mean otherwise; please confirm. The notice kind is the existing DeviceLost.
7. The watch error text (sa430) is only logged: the watcher runs in the background, so it never reaches the UI. It still says the source menu is the way to connect.

Open concerns / for T3 and QA
- device_removed joins the worker while holding the worker lock, and the coordinator waits on that. An in-flight SA430 sweep (up to ~1 s, 5 s timeout) delays the disconnect; the connect-with-settle path takes up to 6 s and also blocks the coordinator. Events queue meanwhile; nothing is lost.
- Shell wiring (T3): AutoConnect::start after AppState is managed; shutdown() before session.disconnect() in RunEvent::Exit; no new IPC.
- Not verified on real hardware. QA procedure belongs to T3.
- Pre-existing and out of scope: none found.
