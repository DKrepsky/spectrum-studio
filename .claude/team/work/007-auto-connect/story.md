# 007 Auto-connect to the first device found
Status: accepted (2026-11-16)

As a user with an SA430 (or any future hardware analyzer), I want Spectrum Studio to connect to my
device by itself when the app starts or when I plug the device in, so that I don't have to open the
source menu every time.

## Decisions from the human (2026-11-16)
- Triggers: at launch, and whenever a device is plugged in while no source is connected.
- Connect only: auto-connect never starts acquisition; the user presses Play.
- Several devices present: the first one discovered wins (discovery order, history ignored).
- Event-driven: use the driver's hot-plug watcher (sa430 `Monitor`, udev on Linux) to react to
  connect/disconnect events, not a polling loop.

## Acceptance criteria
- [ ] Given an SA430 is plugged in and no source is connected, when the app launches, then it
      connects to the device automatically and the toolbar source button shows the device as after a
      manual pick; acquisition stays paused (Play not pressed).
- [ ] Given the app is running with no source connected, when an SA430 is plugged in, then it
      connects automatically within a few seconds of the device being ready (reusing the work-004
      reliable-connect path, no blind retries).
- [ ] Given two devices are present at launch, then the first discovered one is connected, and the
      other stays available in the source menu.
- [ ] Given a source is already connected (simulator or hardware, acquiring or paused), when another
      device is plugged in, then nothing changes: auto-connect never replaces the current source.
- [ ] Given the connected device is unplugged, then the watcher's disconnect event moves the session
      to a disconnected state promptly (UI reflects backend `SessionStatus`), with no crash or hang;
      when it is plugged back in, it auto-connects again (paused).
- [ ] Given the user disconnects manually or an auto-connect attempt fails, then auto-connect does not
      retry on its own; the next attempt happens only on the next plug-in event (or next launch). A
      failed attempt shows the same honest error as a failed manual connect.
- [ ] The simulator is never auto-connected. With no hardware present, launch behaves as today.
- [ ] A device auto-connected is remembered exactly as a manual connect (ADR 0009 rules).
- [ ] Device specifics stay in the driver crate: spectrum-core/session/UI only see a generic,
      optional "device added/removed" capability; drivers without a watcher simply don't trigger
      auto-connect on plug-in (launch-time discovery still applies to them).
- [ ] Tests: core/session tests with a fake watcher (added, removed, already connected, failure, manual
      disconnect); e2e or scripted check at launch; QA on the real SA430 (launch with device, plug-in,
      unplug/replug, simulate re-enumeration via `Sa430::reboot()` as in work 004). `npm run check` green.

## Out of scope
- A setting to turn auto-connect off (can follow if wanted).
- Auto-start acquisition, auto-reconnect retry loops, choosing by last-used history.
- Watchers for non-Linux platforms or for drivers other than SA430.
- New UI copy/notices for auto-connect (minimal copy; the source button already shows the device).

## Notes / constraints
- Never fabricate devices: auto-connect only acts on devices the driver actually discovered/reported.
- The sa430 `Monitor::run` blocks until the handler breaks; the staff engineer must design clean
  start/stop on app exit. If the lib needs a change (e.g. a stoppable monitor), it goes through the
  sa430 repo workflow (issue → PR → release), not a local fork or new direct dependency.
- Record the auto-connect policy and the watcher capability in an ADR.
