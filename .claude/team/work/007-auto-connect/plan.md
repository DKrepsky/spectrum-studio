# 007 Auto-connect: plan (staff engineer)

Decision record: `docs/adr/0014-auto-connect-and-device-watch.md`.

## Approach

Three pieces, device specifics only in the driver:

1. **Generic watch capability** in `spectrum-core::sources` (optional, default off).
2. **Policy** in a new core module `autoconnect.rs` (testable with fake drivers, no Tauri).
3. **Wiring** in `src-tauri` (start at setup, nothing else) and **SA430 driver** implements `watch`
   with `sa430::create_monitor()`.

### 1. Core capability (`crates/spectrum-core/src/sources/mod.rs`)
```rust
pub enum DeviceEvent { Added { location: Option<String> }, Removed { location: Option<String> } } // not exported to TS
trait SourceDriver {
    fn supports_watch(&self) -> bool { false }
    /// Blocks, calling `on_event` per hot-plug event, until it returns Break or the watcher fails.
    fn watch(&self, on_event: &mut dyn FnMut(DeviceEvent) -> ControlFlow<()>) -> Result<(), SourceError> {
        Err(SourceError::unsupported("..."))
    }
}
```
`location` is the same transport address as `DeviceDescriptor.location` (SA430: port path). No
`DriverInfo`/TS change, so no `npm run bindings` impact (run it anyway; expect no diff).

### 2. Session guard (`session/mod.rs`)
- `connect_if_idle(config) -> Result<Option<SessionStatus>, SessionError>`: takes the worker lock,
  and only connects when there is no worker (Disconnected). Returns `Ok(None)` otherwise. This makes
  "never replace an active source" atomic against a manual connect racing the watcher (plain
  `connect` shuts the previous worker down, so it must not be used for auto-connect).
- `device_removed(driver_id, location) -> bool`: under the worker lock, if the active source is of
  that driver and one of its connection text values equals `location`, shut the worker down and set a
  `DeviceLost` notice ("<device label> was unplugged."). Needed because a paused (Connected, not
  acquiring) source does not read, so it would never notice the unplug. No-op otherwise.

Deviations as built (T1/T2): `DriverRegistry::watchable()` and `SessionManager::watchable_drivers()`
return the watching drivers (the registry is private); `SessionManager::connect_if_idle_with_default_fallback`
is the auto path's default-settings retry, which re-checks the guard on each attempt.

### 3. Remember (`remember.rs`)
`auto_connect(session, store, &DeviceDescriptor) -> Result<Option<SessionStatus>, SessionError>`:
config = the remembered entry with the same identity (`same_identity`, so stored centre/span apply,
as after a manual pick, with the default-settings fallback of `connect_with_default_fallback`) else
`SourceConfig { driver_id, device_id: Some(descriptor.device_id), ..default }` (connection empty; the
driver resolves by identity, `port:` ids carry the port). Uses `connect_if_idle`, then the existing
`remember` step (ADR 0009 rules, same as manual). Check that the result sets `lastSourceId` like a
manual pick so the source button is right.

### 4. Policy (`crates/spectrum-core/src/autoconnect.rs`)
```rust
pub struct AutoConnect { /* stop flag */ }
impl AutoConnect {
    pub fn start(session: Arc<SessionManager>, store: Arc<ConfigStore>) -> AutoConnect;
    pub fn shutdown(&self);               // sets the stop flag; does not join
}
// pure, synchronous, unit-tested: launch_scan(&Policy), on_event(&Policy, driver_id, DeviceEvent)
```
Architecture: one **coordinator thread** (`auto-connect`) fed by an mpsc channel. For every
available driver with `supports_watch()` a **watcher thread** (`device-watch-<id>`) runs
`driver.watch`, forwarding events into the channel and returning `Break` when the stop flag is set or
the channel is closed. Order at start: spawn watchers first, then the coordinator does the **launch
scan**, then drains events. A device plugged between scan and watch is therefore queued, never lost;
a duplicate is harmless (idle guard).

Rules (all in the coordinator, serial, so no races among themselves):
- **Launch**: if state is Disconnected, take the first descriptor from `discover_all()`
  (registry order, then driver's order; skips the simulator already: `discover_all` excludes
  `Internal`), `auto_connect` it. Drivers without a watcher take part (launch only). Never opens a
  driver that failed discovery (its error is logged).
- **Added**: only when Disconnected. Run `discover(driver)` and pick the descriptor whose `location`
  equals the event's; none found -> log at debug and do nothing (no invention). Then `auto_connect`.
- **Removed**: `session.device_removed(driver, location)`.
- **No retry**: nothing schedules a second attempt. A failed attempt leaves the normal
  `ConnectFailed` notice (same text as manual, from `SessionManager::connect`). Manual disconnect
  leaves Disconnected and the next Added event is the next trigger. Never auto-starts acquisition.
- Re-enumeration (`reboot()`): Removed then Added in sequence gives disconnect then reconnect.
  Events that arrive during a ~6 s connect wait in the channel/udev socket and are processed after.
- Watcher failure (`watch` returns Err, e.g. no udev): log a warning once, thread ends, app
  continues (launch scan still ran). Panics in the policy are contained by `catch_unwind` per event
  + log, so the app cannot die from it.

### 5. SA430 driver (`crates/spectrum-driver-sa430/src/lib.rs`)
`Sa430Backend` gets `fn watch(&self, handler: &mut dyn sa430::EventHandler) -> Result<(), sa430::Error>`
(real: `sa430::create_monitor()?.run(handler)`; fakes in tests feed scripted events). `Sa430Driver`
implements `supports_watch() = true` and `watch` mapping `Event::DeviceAdded/Removed(port)` to
`DeviceEvent { location: Some(port.name()) }`; errors map to `SourceError::unavailable` with cause.
No new dependency (`sa430` already direct, `Monitor` is in 0.2.1; udev comes in transitively).

### 6. Shell (`src-tauri/src/lib.rs`)
After `app.manage(AppState{..})` in `setup`: `AutoConnect::start(session.clone(), store.clone())`; keep
the handle in `AppState` (`auto_connect`), call `shutdown()` in `RunEvent::Exit` **before**
`session.disconnect()`. No new IPC commands and no frontend change.

## Thread lifetime and exit (explicit)

`Monitor::run` blocks in `poll(-1)` and checks the handler only when an SA430 event arrives, so it
**cannot be woken to stop** and the library offers no stop handle. Decision: **no sa430 change now.**
- The watcher thread is detached; it holds only a udev netlink socket, no device or lock. On app exit
  `shutdown()` sets the flag and the process exit reclaims the thread. It never touches a device
  after exit because the coordinator ignores events once the flag is set (and the process is going).
- Ordering on exit: `shutdown()` -> `session.disconnect()` (takes the worker lock, so it waits for a
  connect in flight; a leftover race is irrelevant because the process ends right after).
- Optional follow-up (not required, goes through the sa430 repo issue -> PR -> release): a
  `Monitor` that can be woken (e.g. `run` with a stop handle / timeout poll). When released, swap the
  detached thread for a joined one. Tell PM if the human wants it.

## Interaction with existing pieces
- **Frontend discovery** (`discover_all`, only while the menu is open) is unchanged; auto-connect uses
  the same enumerate-only call, so it never probes. A scan by the UI and by the coordinator are
  serialised by the existing `scan` mutex.
- **Source memory**: successful auto-connect = manual connect (upsert, `lastUsedMs`, `lastSourceId`).
  Failed one remembers nothing.
- **UI**: reflects `SessionStatus` events only. Check at launch: the connect may finish before the
  webview subscribes; the UI already does `get_status` on load. Verify it shows the device
  (a scripted/e2e check covers it), fix the UI subscribe-then-fetch order only if it is wrong.
- Simulator is never discovered by `discover_all`, so never auto-connected.

## Risks
- Udev `add` event arrives before the port is usable: handled by the work-004 connect path
  (settle, handshake retry, deadline 6 s); no blind retry added.
- Two tty nodes or duplicate events for one device: idle guard + discover-by-location make it a no-op.
- Auto-connect competing with a manual pick: serialised by the worker lock; `connect_if_idle` cannot
  replace.
- A failed launch auto-connect shows a ConnectFailed notice the user did not ask for; accepted by the
  human decision (same honest error). Flag to PM, no extra copy.
- Detached thread has no clean stop (see above).

## Test plan
- **Core, `autoconnect` tests** with a fake driver (scripted `discover`, `open`, `watch` fed from a
  channel) and `SessionManager` + temp `ConfigStore`:
  launch connects the first non-simulator device paused (state Connected, not Acquiring);
  launch with none/with only the simulator does nothing; launch discovery error logs, no connect;
  Added when idle connects the matching device (second device ignored);
  Added when Connected/Acquiring (simulator or fake hardware) changes nothing;
  Added with unknown location does nothing;
  Removed of the active device -> Disconnected + `DeviceLost` notice, also while paused; Removed of
  another device does nothing; Removed then Added reconnects;
  failed open -> `ConnectFailed` notice, state Disconnected, `open` called exactly once (no retry),
  second Added retries once;
  manual disconnect then nothing happens until the next Added;
  success is remembered (store has the entry, stored settings applied); failure remembers nothing;
  `connect_if_idle` returns `None` and keeps the source when one is connected;
  watcher error/closed channel ends the thread; `shutdown` makes further events ignored.
- **Session tests** for `connect_if_idle` and `device_removed` (race: manual connect during
  auto-connect leaves the manual source).
- **SA430 driver tests**: fake backend events map to `DeviceEvent` (added/removed, port name),
  `supports_watch`, Err mapping; add a session-level test in `tests/` (driver + fake backend +
  `AutoConnect`): added -> connected paused, removed -> disconnected.
- **Launch-time check**: scripted e2e is hard (no hardware in CI). Provide a core-level launch test
  plus a documented manual/QA procedure on the real SA430 (launch with device, plug-in, unplug/replug,
  `Sa430::reboot()` cycles as in 004, device plus simulator selected). An e2e spec only if
  it works against the simulator-only build (assert launch with no hardware = Disconnected, no
  notice); keep it optional.
- `npm run check` green; `npm run bindings` shows no diff.
- Docs: `docs/sources.md` (watch capability, auto-connect), `docs/architecture.md` (one paragraph),
  `docs/roadmap.md`, ADR 0014.

## Tasks
T1 core (capability, session guards, remember, policy, tests, docs core part),
T2 SA430 driver watch (parallel with T1 once the trait is fixed as above; merge after T1),
T3 shell wiring + QA procedure + docs/roadmap (after T1 and T2).
