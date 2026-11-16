# Review T1 + T2 (007 auto-connect), staff engineer

Verdict: **approve** (no must-fix). `cargo test --workspace` green (core 27 autoconnect tests, sa430 3 session + 4 lib).
Boundaries hold: `autoconnect.rs`, session and remember name no device; SA430 specifics (port name, udev monitor) stay in the driver. No new dependency, no TS type change.

## must-fix
None.

## device_removed joins the worker under the worker lock (the flagged concern): acceptable
- `session/mod.rs` `device_removed` (~l.425): holding the worker lock across `shutdown_worker` is required for atomicity against a racing manual connect, and is exactly what `connect`/`disconnect` already do. For a real unplug the in-flight read fails at once (port gone), so the join is fast; the 1 s/5 s figure is the worst case for a wedged read.
- The ~6 s block while the coordinator runs a connect is inherent (connect_if_idle holds the same lock) and harmless: events queue in the mpsc channel in order; nothing is lost; a Removed queued behind a connect is applied after it.
- Lock order is sound: `discover`/`discover_all` run before the worker lock is taken (`on_event`, `launch`), no lock is held across them; `status()` is taken inside the worker lock only (leaf lock). No deadlock found.
- should-fix (T3 awareness, not T1/T2): while the coordinator holds the worker lock for a launch connect (<= 6 s), a user Play/Pause/Stop IPC call blocks on the same lock. Pre-existing for manual connect, but now it can happen without user action at startup. T3 must keep the commands off the main thread (check they are `async`/blocking-pool) so the window does not freeze. Mention in the QA procedure (press Play within ~6 s of launch).

## should-fix
1. `crates/spectrum-core/tests/autoconnect.rs:701` `a_manual_connect_is_never_replaced_by_auto_connect`: the simulator is connected before `start`, so `Policy::is_idle` short-circuits and the atomic `connect_if_idle` guard is never what saves it. The real race (state read Disconnected, then a manual connect lands before `connect_if_idle`) is not exercised. Either add a test with a gate in a fake `open` (manual connect blocks the lock, auto attempt arrives, assert `None` and manual source kept), or rename the test honestly. `connect_if_idle_leaves_a_connected_source_alone` (l.552) covers the direct guard, so this is low risk; I accept a rename plus a short comment if the gate test is awkward.
2. Negative tests rely on fixed sleeps (l.665 300 ms, l.708 200 ms, l.723 100 ms, sa430 tests/autoconnect.rs:242 200 ms). They cannot flake red, but "not retried" can pass vacuously if the coordinator is slow. Prefer a sentinel: after the action under test, send one more event (or a Removed no-op) and wait until it has been processed, then assert. Not blocking.
3. `crates/spectrum-core/src/autoconnect.rs:77-97` Added: if the scan right after a udev `add` does not yet list the port (no match), the event is dropped at debug level and no retry follows (by design in the ADR). Real hardware needs confirmation in QA that the port is enumerable when the udev add arrives (the `sa430` scan filters by USB ids, so likely yes). Log this case at `info` instead of `debug` so a field report ("it did not connect") is diagnosable. One-word change.

## nits
- `docs/sources.md` SA430 hot-plug bullet: last line wraps oddly ("logs one warning and only launch-time auto-connect works; plug events / are only reported on Linux"). Reflow; "only reported on Linux" is a platform statement, say so once.
- `docs/architecture.md` says the shell starts and stops it: true only after T3; fine if T3 lands in the same commit, otherwise do not commit T1/T2 alone with that sentence.
- `sa430/src/lib.rs` `watch_error` text mentions "source menu" but is only logged. Harmless; keep (the log is user-readable).
- `connect_if_idle_with_default_fallback` retries through `connect_if_idle` twice; correct (guard re-checked each time). Add one line of comment saying so.
- Update plan.md/ADR 0014 with deviations 1 and 2 (`DriverRegistry::watchable`, `SessionManager::watchable_drivers`, `connect_if_idle_with_default_fallback`) so the docs match the code.

## The 7 listed deviations
1. watchable()/watchable_drivers(): accepted (needed; registry private; keeps Arc drivers off the public session API otherwise).
2. connect_if_idle_with_default_fallback: accepted; shared `retry_with_defaults` removes duplication, behaviour of the manual path unchanged (existing tests green).
3. Policy returns `()`, holds Arcs: accepted.
4. SA430 failure test uses launch failure then plug-in: accepted; Added-failure is covered in core (l.455) and the thread test (l.658).
5. Unique temp dir without tempfile dev-dep: accepted (no new dependency); make sure it is removed on panic too (Drop does this).
6. DeviceLost "<label> was unplugged.": accepted by PM decision.
7. Watch error only logged: accepted; matches plan (background, no UI path).

## Checked and fine
- Never replaces an active source; never starts acquisition; simulator never discovered; failure remembers nothing and opens exactly once (asserted via `opens` counter).
- `catch_unwind` per step, `lock()` tolerates poisoning; watcher Err ends only its thread and launch still runs (tested).
- Shutdown: flag checked in watcher callback, coordinator loop and `on_event`/`launch`; detached watcher documented; matches ADR 0014. Exit order for T3: `shutdown()` then `session.disconnect()`.
- `device_removed` matches by driver id plus any text value in the resolved connection map; `worker.rs` extends `connection` with `opened.connection`, so identity-only auto-connect configs still match (the SA430 resolved port is recorded). Add a core test asserting this for a config with empty connection if not already covered by `removed_while_paused...` (it appears to be).
