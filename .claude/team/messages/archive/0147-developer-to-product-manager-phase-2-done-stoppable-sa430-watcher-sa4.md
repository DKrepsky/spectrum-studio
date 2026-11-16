---
id: 0147
from: developer
to: product-manager
type: handoff
subject: Phase 2 done: stoppable SA430 watcher, sa430 0.2.2, real-device exit check
work: 008-stoppable-monitor
reply-to: 
date: 2026-11-16T05:57:37-03:00
---

Phase 2 (Spectrum Studio) is implemented. Not committed. Evidence: `.claude/team/work/008-stoppable-monitor/dev-phase2.md`.

**Changed files**
- `Cargo.toml`, `Cargo.lock`: sa430 0.2.1 -> 0.2.2 (lock diff is only the sa430 entry).
- `crates/spectrum-core/src/sources/mod.rs`: generic `SourceDriver::supports_stop_watch()` (default false) and `stop_watch()`.
- `crates/spectrum-core/src/autoconnect.rs`: `AutoConnect` keeps each watcher (driver, JoinHandle, done-channel). `shutdown` stops event handling, calls `stop_watch` on stoppable watchers, waits at most 1 s in total, then joins those that ended. Others are detached with a warn. Idempotent.
- `crates/spectrum-driver-sa430/src/lib.rs`: the backend seam is now `monitor()` (returns `Box<dyn sa430::Monitor + Send>`), so the driver runs the monitor and holds its `MonitorStopHandle`. `WatchStop` (flag + handle under one Mutex). `watch` stores the handle, re-checks the flag, then `run`. `stop_watch` sets the flag and calls the handle.
- `src-tauri/src/lib.rs`: comment only.
- Tests: `crates/spectrum-core/tests/autoconnect.rs` (fake watcher gets stop, gate, unstoppable and ignore-stop switches), `crates/spectrum-driver-sa430/src/lib.rs` (parked fake monitor), and the three integration test fakes (`tests/autoconnect.rs`, `tests/hardware.rs`, `tests/session.rs`) moved to `monitor`.
- Docs: ADR 0014 (shutdown section amended, new alternative), `docs/sources.md` (trait summary, stopping section, SA430 limits), `docs/architecture.md` (shutdown), `docs/roadmap.md` (removed the "cannot be woken" Known limitation).

**Tests added (all green)**
- Core: `shutdown_ends_a_blocked_watch_and_joins_its_thread_promptly` (joined, under 500 ms), `a_stop_requested_before_the_watch_starts_still_ends_it` (gate), `an_unstoppable_watcher_stays_detached_and_ignores_events_after_shutdown`, `a_watcher_that_ignores_the_stop_is_left_behind_after_a_bounded_wait` (about 1 s), and a shutdown timing check added to `a_watcher_error_ends_its_thread_and_the_app_carries_on`. Removed the old `shutdown_ends_the_watcher_at_its_next_event_and_ignores_it`: it sent an event after shutdown, which now hits a dropped receiver. Its "ignores events" part lives in the unstoppable test.
- SA430 driver: `stop_wakes_a_blocked_watch_which_then_returns_ok`, `stop_before_the_watch_starts_makes_it_return_without_running`, `stop_during_monitor_creation_is_not_lost` (deterministic race: stop lands between monitor creation and handle storage), `the_sa430_driver_supports_stopping_its_watch`.

**Checks**
- `npm run check`: exit 0 (rustfmt, clippy -D warnings, cargo test workspace, Prettier, ESLint, tsc app+e2e, Vitest 263/263). Re-run after the last code edit.
- `npm run bindings`: no diff in `src/bindings` (no exported type changed).
- clippy -D warnings on all targets: clean.

**Real device (SA430 on /dev/ttyACM0)**
- No human-started instance was running. Debug build with the frontend embedded, `XDG_CONFIG_HOME` in scratch.
- Launch auto-connected (`auto-connected device=SA430 08FF41E50F8B3A34`).
- Closed the window via `wmctrl -i -c` (WM_DELETE). Watcher stopped 3.5 to 7 ms later, joined at shutdown, source disconnected, process gone 58 to 64 ms after close. Two cycles, both logged.

**Deviations and notes**
- The driver backend seam changed from `watch(handler)` to `monitor()`. The driver needs the handle before `run`, so this was needed. The fakes were updated to match.
- Shutdown is bounded at 1 s total; a stuck watcher is detached with a warn.
- No e2e run: no user-visible change.
- The roadmap has no row for 008 yet. I did not add one, since that is your call. The 007 row still says "sa430 0.2.1" in the history text, which I left alone.
- Not verified on device: a plug/unplug while running (this run did not unplug).
- Open for you: whether to say in the sa430 changelog/PM notes that Studio now uses the stop handle.
