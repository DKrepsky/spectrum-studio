# ADR 0014 — Auto-connect policy and the optional device watcher

Status: accepted (2026-11-16); shutdown section amended 2026-11-16 (work 008)

## Context

Work item 007: users with a hardware analyzer want Spectrum Studio to connect at launch and when the
device is plugged in. The SA430 library (0.2.1) provides a hot-plug `Monitor` (udev). Core, session
and UI must stay device-agnostic ([ADR 0004](0004-source-abstraction.md), [ADR 0008](0008-driver-crates.md)).

## Decision

- **Optional watcher capability on `SourceDriver`:** `supports_watch()` (default false) and a blocking
  `watch(on_event)` that reports `DeviceEvent::{Added, Removed}` with the same `location` as
  `DeviceDescriptor.location`. Events carry no identity: the core resolves it with the enumerate-only
  `discover`. Drivers without a watcher still take part at launch.
- **Policy lives in `spectrum-core` (`autoconnect.rs`)**, not in the shell or a driver, so it is
  testable with fake drivers. One coordinator thread serialises all decisions; one detached watcher
  thread per watching driver only forwards events.
- **Rules:** at launch connect the first discovered non-simulator device if nothing is connected; on
  `Added` connect that device only if no source is connected; on `Removed` of the active device
  disconnect promptly with a `DeviceLost` notice; never replace a source, never start acquisition, no
  retry loop (the next attempt is the next `Added` or launch). Connecting is the ordinary path
  (work-004 reliable connect, ADR 0009 remembering with stored settings).
- **Watchers are found through `DriverRegistry::watchable()` and `SessionManager::watchable_drivers()`**,
  so the registry stays private and the session API does not expose driver handles otherwise.
- **Retry with defaults on the auto path**: `SessionManager::connect_if_idle_with_default_fallback`
  retries once without stored settings (as the manual path does), each attempt through
  `connect_if_idle`, so the guard is re-checked for the retry too.
- **"Never replace" is enforced by the session**: `connect_if_idle` checks under the worker lock, so a
  racing manual connect always wins. `device_removed` exists because a paused source does not read
  and would not notice an unplug.
- **Shutdown (amended, work 008):** `AutoConnect::shutdown` first stops reacting to events, then calls
  `SourceDriver::stop_watch` on every driver whose `supports_stop_watch()` is true, and joins each of
  those watcher threads. The wait is bounded (1 s in total); a watcher still running after it is left
  detached and ends with the process. Drivers without a stop keep the detached behaviour. The core
  sees only this generic capability. The SA430 driver implements it with the `sa430` 0.2.2 monitor's
  stop handle. It stores the handle under the same lock as a stop flag, and `watch` re-checks the flag
  after storing the handle, so a stop that comes before the monitor exists is not lost. A watcher error
  ends its thread with a log line; the app keeps running. The shell calls `shutdown` on `RunEvent::Exit`
  before `session.disconnect()`.

## Alternatives rejected

- Polling `discover_all` in a timer: wasteful, slow, and the human asked for events.
- Policy in the Tauri shell or the frontend: untestable, and the UI must not decide connections.
- Auto-reconnect/retry loops: hide real failures, fight the user's manual disconnect.
- Forking sa430 or adding `udev`/`libc` as direct dependencies to get a stoppable watcher.
- Killing or abandoning the watcher thread at exit without a stop: it works, but leaves the device
  event source unclosed until process teardown and cannot prove the watcher has ended.
- Choosing by last-used history: the human chose "first discovered".

## Consequences

- One thread parked in `poll` for the app lifetime on Linux with an SA430 driver; it is woken at exit.
- Without udev (or off Linux) the watcher fails once with a log warning; launch auto-connect still works.
- Setting to turn auto-connect off is out of scope; the policy is a single entry point (`AutoConnect::start`) so
  gating it by a preference later is trivial.
