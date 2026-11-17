# 011 Plan: Reconnect after a failed Reconnect (issue #1)

## Root cause (reproduced)

The backend does the right thing. The bug is entirely in the frontend: two pieces of UI state that are
**not derived from `SessionStatus`** survive a connect that the UI did not start.

Sequence of the issue, with what each side holds:

| Step | Backend (`SessionStatus`) | Frontend stores |
| --- | --- | --- |
| 2 unplug | worker ends on a fatal read (`worker.rs` `acquire_once`) or `device_removed`: Disconnected + `deviceLost` notice | banner with Reconnect |
| 3 Reconnect, device absent | `connect` -> `open_locked`: Connecting, then Disconnected + `connectFailed` notice ("Could not connect to TI SA430 ...: Could not open ...") | `session.connectTo` fails: `commandError = "Could not open ..."` (the IPC error, no "Could not connect" prefix), `commandErrorFrom = 'connecting'`, `useSources.failed = <row key>` |
| 4 plug-in | `device-watch-sa430` emits Added, `Policy::on_event` -> `remember::auto_connect` -> `connect_if_idle`: Connecting (clears `lastNotice`), then Connected. **This connect succeeds.** | `receiveStatus` stores the new status only |

### (a) The "Could not open /dev/ttyACM0: serial port error" at plug-in is not a second failure

It is the **stale `commandError` from step 3**, unmasked. `NoticeBanner` hides a `commandError` from
`connecting` only while the notice is `connectFailed` (`NoticeBanner.tsx`, the `commandErrorFrom === 'connecting' && notice?.kind === 'connectFailed'` condition; the two are the same
failure, shown once). When the auto-connect starts, the backend sets `lastNotice = None`, the mask
stops applying, and the old command error appears: same words as the step-3 notice minus the
"Could not connect to ..." prefix, which is exactly the text in the issue screenshot. Nothing clears
`commandError` except the next UI command or the user's dismiss; an auto-connect is neither.
The text is the IPC `SessionError::Source` message (`Could not open {port}: {error}.{hint}` from
`open_error` in the sa430 driver), which is why it matches step 3's cause.
I found no evidence of a racing, parallel or leaked connect on the backend: `connect`/`connect_if_idle`
serialise on the worker lock, a failed open joins its worker thread (port dropped) and leaves the
slot empty, and `identify` drops each failed attempt's `Sa430` before retrying.

### (b) "Failed" red X with an enabled capture button

`useSources.failed` (row key of the last failed pick) is set by `connectTo` on failure and cleared
only at the start of the next `connectTo` (`state/session.ts`; the store comment says "or success"
but only the UI-initiated success path does it). `receiveStatus` never clears it. In
`status.tsx` `activeStatus()` returns `'failed'` **before** looking at the backend state, and
`SourceMenu` does the same per row. So after the auto-connect the source button shows Failed
while `status.state === 'connected'`; `CaptureControl` reads only `status.state`, so capture is enabled
and works. UI state diverges from `SessionStatus` because a local marker outranks it.

### Reproduction

Temporary Vitest (since removed) in the real stores: `connectTo` rejects with "Could not open
/dev/ttyACM0", then statuses connecting (rev 3) and connected with a source (rev 4) arrive via
`receiveStatus`. Result: `failed = 'source-entry-e1'`, `commandError = 'Could not open /dev/ttyACM0'`,
`status.state = 'connected'`. This is the exact failing state of the issue; the regression test in T1
is this sequence.

### Not verified (needs the human, or not applicable)

- Real unplug while connected and the real udev Added event after a failed Reconnect (physical).
  The code path after the event is covered by the scripted Rust tests; the real driver's
  reconnect-after-replug is covered by work 004/007 hardware tests (`Sa430::reboot()` re-enumeration).
- I did not run the app against the SA430; the root cause is deterministic in the frontend and reproduced
  with the real store code.

### Secondary finding (backend, small): a plug-in during a failing connect is dropped

`Policy::on_event(Added)` skips unless `state == Disconnected` (`is_idle`). A Reconnect against an
absent device runs the driver's retry ladder (`NoDevice` is retryable: up to ~1 s of backoff, longer
for other errors; whole connect up to 6 s, `OPEN_TIMEOUT` 30 s) with state `Connecting`. A plug-in
inside that window is discarded and never retried, so the device stays unconnected until Reconnect
is pressed again. This is not what the issue shows (steps 3 and 4 are sequential), but it is the same
user story ("Reconnect while unplugged, then plug in") and violates the story AC "a Reconnect pressed while
the device is absent ... leaves no state that breaks the next connect". Fix: treat only
`Connected`/`Acquiring` as "a source is active"; for `Connecting`/`Disconnecting` fall through to
`connect_if_idle`, which waits on the worker lock and then re-checks (a successful manual connect
leaves `Ok(None)`; a failed one lets the plug-in connect). Cost: the coordinator thread blocks for
the duration of the manual connect, which already holds the lock; no new lock order issue (the
coordinator takes no other lock).

## Fix approach

Principle (CLAUDE.md): the UI reflects `SessionStatus`; a local marker may only describe the last
*UI-initiated* failure while the backend is still disconnected.

### T1 Frontend (no IPC/bindings change)
1. `state/session.ts` `receiveStatus`: after storing the status,
   - if `status.state` is `connecting`, `connected` or `acquiring` (any state with a live attempt or
     source), `useSources.setFailed(null)`. A new attempt (UI or backend) invalidates the old
     failure, and a connected source is by definition not failed.
   - if the same condition holds and `commandErrorFrom === 'connecting'`, clear `commandError` /
     `commandErrorFrom`. That error is the connect failure the notice already mirrors; once the backend
     moves on, it is stale. Other command errors (start, stop, apply, warnings, display) are not touched.
2. `components/source/status.tsx`: defence in depth, so the invariant is local to the
   function that renders it: `failed` counts only while `state === 'disconnected'`
   (a Failed source never shows with a connected/acquiring/connecting backend). Keep the
   signature if possible; same for the `failed === row.key` early returns in `SourceMenu.tsx`
   (`entryStatus`, `detectedStatus`): route through a helper so the rule lives once.
3. Fix the `sources.ts` `failed` doc comment ("cleared when the backend leaves Disconnected").
4. No change to `NoticeBanner` logic needed (its mask stays valid for the sequential failure case);
   do not add banner-level hacks.

### T2 Backend hardening (core only)
`autoconnect.rs` `Policy::on_event` Added branch: replace the `is_idle()` precheck with "skip when a
source is Connected/Acquiring"; `Connecting`/`Disconnecting` go on to `connect_if_idle`. Keep launch's
check as is (nothing else can be in flight at launch). Update the doc comment and the ADR 0014 note if it
states the precheck (one line; no new ADR).

## Design system
No new components; `StatusDot`, `Banner`, `Button` reused as is. No DESIGN.md/stories change.

## Risks
- Clearing `failed` on `connecting` also covers the UI's own flow: `connectTo` already clears it before
  the command; the status event arrives after, so no flicker. On failure, `connectTo` sets `failed`
  *after* `await command()`, by which time the backend status is `disconnected`, so the new marker
  sticks (the rev-ordering check keeps a late `connecting` event from clearing it: the final
  `disconnected` revision is newer). Pin this order with a test (see T1): events connecting ->
  disconnected(connectFailed) then `setFailed` must keep Failed.
- Race where the Disconnected status event arrives *after* `connectTo` resolved and sets `failed`
  and the later `connecting` of an auto-connect clears it: correct (new attempt).
- T2: the coordinator blocks behind a long manual connect (up to 30 s worst case); events queue in
  the channel (unbounded mpsc) and are processed afterwards, same as the existing launch behaviour.

## Test plan
- Frontend (Vitest, `src/state/session.test.ts`, `src/components/source/*.test.tsx`):
  - event sequence regression of the issue: failed `connectTo`, then `connecting`, `connected` ->
    `failed === null`, `commandError === null`; `SourceButton` shows Connected, not Failed.
  - failure still sticks: `connectTo` fails with backend `connecting` -> `disconnected+connectFailed`
    -> `failed` set, error banner path unchanged (existing tests stay green).
  - unrelated command error (e.g. `commandErrorFrom: 'starting'`) survives a status change.
  - `activeStatus(connected, null, true, false)` is `'connected'`; `(disconnected, null, true, ...)`
    is `'failed'`. Menu row likewise.
  - `status` that arrives out of order (older revision) never clears anything.
- Rust (`crates/spectrum-core/tests/autoconnect.rs`, scripted driver, no hardware):
  - R1: connect, unplug (fatal read or `Removed`), manual `connect` fails (`failing_opens`), then
    `Added` -> Connected with `lastNotice == None`, exactly one successful open after the failure.
  - R2: a manual connect that is still opening (gate in `open`, state `Connecting`) and then fails,
    with `Added` delivered while it is in flight -> device ends Connected (fails before T2).
  - R3: same as R2 but the manual connect succeeds -> the auto path does not replace it.
- `npm run check` green; bindings unchanged (`git diff src/bindings` empty).
- QA on the real SA430: app idle, `Sa430::reboot()` re-enumeration while Disconnected after a failed
  Reconnect (device absent for ~660 ms) to see Added -> Connected with no banner/Failed; the human
  does the physical unplug/replug (steps 1-5 of #1) and confirms no Failed dot and no stale banner.
