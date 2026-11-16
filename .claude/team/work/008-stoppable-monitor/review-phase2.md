# 008 phase 2 review (staff-engineer)

Verdict: APPROVE. No must-fix.  `npm run check` is green (fmt, clippy, all tests, vitest, tsc).

## Must-fix
None.

## Should-fix
None blocking. One worth a follow-up decision:
- crates/spectrum-driver-sa430/src/lib.rs `watch`/`stop_watch`: `requested` is sticky for the driver's lifetime, so any
  later `watch()` call on the same driver returns Ok at once. Correct today (one watcher per app run, stop only at
  exit) and documented in the trait doc ("must still end the next watch"), but a future "restart the watcher" feature
  would have to reset it. Mention in the ADR or leave; no change needed now.

## Nits
- lib.rs `watch`: the stale `MonitorStopHandle` stays in `WatchStop.handle` after the watch ends. Harmless (stop is
  idempotent per sa430 0.2.2), but `stop.handle = None` on exit would be tidier.
- lib.rs `watch`: if `monitor.stop_handle()` returned `None` (a non-Linux monitor), `supports_stop_watch()` is still
  true and shutdown waits the full 1 s. Unreachable today (create_monitor is Unsupported there, thread ends at once);
  could be reported as "not stoppable" later.
- core autoconnect.rs `shutdown`: watchers that are not stoppable have their JoinHandle dropped when the Vec is consumed
  (detach, intended); a one-line comment would make that explicit.

## Checks asked for
- Races. Stop before the monitor exists: `requested` set under the lock; `watch` re-checks it after storing the handle
  under the same lock, so it returns Ok without running (test `stop_during_monitor_creation_is_not_lost` hooks exactly
  that window). Stop after the handle is stored and before `run`: relies on the sa430 0.2.2 guarantee (stop before
  run returns immediately, phase 1 criterion), and the lock is not held across `run`, so `stop_watch` never blocks.
  Stop while `run` blocks: covered with a condvar-backed fake monitor.
- Shutdown idempotency: `mem::take` empties the Vec under the lock, so a second call has nothing to stop or join; the
  policy flag is already set. The watcher thread holds `done_tx` for its whole life (dropped on panic too), so
  `recv_timeout` -> Disconnected means "ended" with no false positives; `join` then cannot block.
- Never hangs exit: one shared 1 s deadline for all watchers (not per watcher); on timeout the thread is detached. The
  watcher handler returns Break once `policy.is_stopped()`; the event channel is unbounded so the watcher cannot block on
  send. Shell order unchanged: `shutdown()` before `session.disconnect()`.
- Device-agnostic: core sees only `supports_stop_watch`/`stop_watch` (defaults false/no-op); `MonitorStopHandle` and
  udev stay in the sa430 driver. `monitor()` seam returns `sa430::Monitor` trait object, backend stays injectable.
- Watcher error (#79): `watch_error` path unchanged; thread ends with a log, shutdown does not wait for it (test
  asserts shutdown < 500 ms after an error).
- Removed `shutdown_ends_the_watcher_at_its_next_event_and_ignores_it`: justified. It is not deleted but replaced by
  `an_unstoppable_watcher_stays_detached_and_ignores_events_after_shutdown`, which keeps the same assertions (event after
  shutdown ends the watch, no open) for the non-stoppable path; the stoppable path is the new join test. The new
  tests assert behaviour (joined before shutdown returns, stop count == 1, bounded wait 0.9..3 s for an ignoring
  watcher). Fake `stop_ignored` test is a bit timing-based (1 s) but tolerant.
- Docs: ADR 0014, architecture.md, sources.md, roadmap limitation removal are accurate against the code. The ADR says
  "(1 s in total)" and "stores the handle under the same lock as a stop flag" - matches. Cargo.toml/Cargo.lock only
  bump sa430 to 0.2.2.

## Hardware regression (SA430 08FF41E50F8B3A34 on /dev/ttyACM0; no other spectrum-studio running; none killed)
Rebuilt `npx tauri build --debug --no-bundle`, isolated XDG_CONFIG_HOME, RUST_LOG debug.
1. Launch -> `auto-connected` 08:58:45.45 (connect ~0.24 s).
2. `sa430 reboot` while connected -> "Device or resource busy" (expected per recipe; app unaffected).
3. WM close at 08:58:57.077: `device watcher stopped` +4 ms, `device watcher joined at shutdown`, `source disconnected`
   +6 ms, process gone 62 ms after the close request, no signals.
4. Plug-in path through the watch seam (temporary wdio probe spec, deleted afterwards, using WebKitWebDriver from the
   scratchpad): launch -> auto-connect -> manual disconnect (`ensureDisconnected`) -> `sa430 reboot /dev/ttyACM0`
   (udev remove+add) -> app auto-connected again ~1.0 s later (08:59:25.41), state Connected, acquire state `idle`
   (paused), 1 passing. So the new `monitor()`/`run` path delivers events.
   Not observed: a literal "auto-connect paused" banner; I only asserted idle/paused state. No stray process afterwards.
   A physical unplug while connected was not possible (no root), as the recipe notes.
