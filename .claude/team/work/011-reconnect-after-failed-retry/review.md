# 011 Review: verdict APPROVE

Reviewed the uncommitted diff (T1 frontend, T2 core autoconnect) against plan.md, T1.md, T2.md and
CLAUDE.md. PM ran `npm run check` on the combined tree: exit 0.

## T1 frontend
- Clearing happens in `receiveStatus` only after the out-of-order guard (`revision <= previous`), so a stale or
  reordered `connecting` event cannot erase a newer failure. A test asserts it.
- Race "clearing hides a genuine later failure": a genuine failure sets `failed`/`commandError` in the
  `connectTo` catch, after the connecting status, and the status that follows (disconnected) clears nothing.
  The real event order (connecting then disconnected) has its own test. Backend-initiated failures surface
  through `lastNotice` (`connectFailed`), which is untouched. No hiding path found.
- Only `commandErrorFrom === 'connecting'` errors are cleared; other command errors are kept (tested).
- `showsFailed` makes backend state win in `activeStatus` and both `SourceMenu` row paths; display is derived
  from `SessionStatus`. Unit tests in `status.test.ts` cover it. No bindings change, none needed.

## T2 core
- `on_event(Added)` now skips only for Connected/Acquiring; Connecting/Disconnecting fall to
  `connect_if_idle`, which re-checks under the worker lock. A successful manual connect yields `Ok(None)`
  (never replaced: test R3 asserts device b stays, one open). A failed one lets the plug-in connect (R2, two
  opens, no notice). No double connect possible: both paths serialise on the worker lock.
- Cost is a coordinator thread blocking for the manual connect's duration; acceptable, noted in plan, no new
  lock order.
- Tests are deterministic (channels, gates, timeouts) and assert state, device, notice and open counts.
  R1 reproduces the issue sequence at session level.
- No device specifics added to core/UI.

## Notes (non-blocking)
- Real-hardware unplug/replug of the SA430 is not verified here; needs the human.
- Doc comment on `Policy::on_event` updated; no further doc change needed.
