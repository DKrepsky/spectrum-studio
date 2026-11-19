# ADR 0017 — Simulator fallback at launch and replacing an idle simulator

Status: accepted (2026-11-19, work 015, issue #46); amends [ADR 0014](0014-auto-connect-and-device-watch.md)
and the "no selected-but-not-connected state" rule of [ADR 0009](0009-automatic-source-memory.md)

## Context

Work 015: a source is always selected. With no device at launch the app connects the Signal simulator
(idle, never acquiring); a device that appears later must take over from it. ADR 0014 said "never
replace a source" and "the simulator is never auto-connected". The human decided at the design gate
that any idle simulator is replaced (auto-started or picked by the user), that a device that is
detected at launch but fails to connect stays selected in Failed with no simulator fallback, and that
an acquisition is never interrupted.

## Decision

- **The simulator is chosen by kind, not by name.** The auto-connect policy picks the first available
  driver whose `DriverInfo.kind` is `SourceKind::Simulator` as the fallback. Core code that is not the
  simulator never mentions its id.
- **Launch rule (`Policy::launch`).** Nothing connected: connect the first discovered device. Only when
  discovery found no device (or every scan failed) connect the fallback simulator through the same
  remembering path as a device (`remember::auto_connect`, ADR 0009), so its stored settings apply and
  it becomes the selection. A device that was found but failed to connect is not followed by a
  fallback: the session stays `Disconnected` with the `ConnectFailed` notice and the device stays the
  selection (`SessionStatus.last_config`). Nothing starts acquisition.
- **Replacing an idle simulator.** `connect_if_idle` keeps its name and guard point (under the worker
  lock) and now treats a source as replaceable when the session is `Connected` (not `Acquiring`) and
  `ActiveSource.simulated` is true, in addition to "no worker". A real device that is connected or
  acquiring is never replaced; a simulator that is acquiring is never replaced. `Policy::on_event`
  uses the same rule (one pure function `may_replace(&SessionStatus)` in the session module) so the
  pre-check and the guard cannot disagree. There is no "auto-started" flag: the human chose "any idle
  simulator". If the device then fails to open, the session ends `Disconnected` with `ConnectFailed`
  and the device is the selection; the simulator is not reconnected (same principle as launch).
- **Unplug.** `Removed` still closes the active device with `DeviceLost`; no fallback is connected. The
  lost device stays the selection (Not detected).
- **Start-up signal.** `SessionStatus` gains `launching: bool`. `AutoConnect::start` sets it before the
  coordinator thread runs; the coordinator clears it (also after a panic or when the thread cannot be
  spawned) once the launch rule has finished. The UI shows "Loading…" until the first status arrives
  and while `launching` is true with no connect started, so it never shows a stale remembered name.
  The flag is `false` for a `SessionManager` that no `AutoConnect` ever started (tests, embedders).
- **Selection is not a new backend state.** The selection stays the UI's `active` entry, derived from
  the persisted `lastSourceId`, the connected source and, while connecting or after a failed connect,
  `SessionStatus.last_config`. After Disconnect or Forget the UI keeps or falls back to a selection;
  the backend stays `Disconnected` and never connects by itself.

## Alternatives rejected

- **An "auto-started" flag in the session** (designer's recommendation): the human rejected it; it also
  needs a second piece of state that a restart cannot restore.
- **Falling back to the simulator when a detected device fails to connect:** hides a real failure
  (permissions, busy port) behind a working-looking source.
- **Opening the new source before closing the simulator:** the session has one worker slot; two open
  sources would change the whole lifecycle for a rare case.
- **The UI deciding the fallback or the replacement:** untestable and races with manual picks; the
  session guard is the only place that can be atomic.
- **A separate `connect_replacing_idle_simulator` method:** two guards that must agree; one rule in one
  place is simpler.

## Consequences

- ADR 0014's sentences "never replace a source" and "the simulator is never auto-connected" are
  superseded by this ADR (0014 gets a one-line pointer).
- A first launch with no device now writes a `sources.json` entry for the simulator and sets
  `lastSourceId`; the UI hides unnamed simulator entries in "Your sources" and always offers the
  simulator in the fixed block (named legacy presets stay listed).
- `SessionStatus` changes: run `npm run bindings`.
- The e2e specs start with the simulator connected (not "Choose a source"); helpers and specs that
  assumed a disconnected start must disconnect first.
