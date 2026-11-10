# Review T7 (BUG-1 queued Stop) - staff-engineer

Verdict: APPROVED. No blockers. `npm test` 259/259 and `cargo test -p spectrum-core --test session`
25/25 green on the working tree (app/e2e not run, QA is using it; stash check not done for the same
reason, I verified by reading that the tests assert the queued behaviour: the no-gap and
"not called before start resolved" assertions cannot pass on the old `if (busyNow) return`).

## Checked
- Busy transitions, no hang: `start()` runs the whole start+queued Stop inside one `command('starting')`,
  so `busy` goes starting -> stopping -> null with no null gap. `attempt` never throws; the `finally`
  always clears `startInFlight` and settles a still-pending queued Stop as `false`, so a failed start
  or a failed Stop resolves the `stop()` promise and clears `busy`. Start-failure reports the start
  error (commandErrorFrom 'starting'); Stop failure reports 'stopping' and `cancelled` is reset by
  the `.then`. Only remaining hang is an invoke that never resolves, as before the change.
- Ordering: Stop is sent strictly after the start invoke resolves; second press in the window is
  ignored (busy 'stopping' in `onMain`, and `queuedStop.done` reuse in the store for programmatic
  callers). 'stopping'/'applying' presses still ignored (tested).
- Continuous Pause in the same window: takes the `else void stop()` path, same queue, tested.
- Late sweep: `published` (frameStore seq vs `frameAtStart`) keeps "Single capture complete" and
  suppresses "cancelled" when a frame was shown; a failed Stop does not leave `cancelled` set.
- Tests deterministic: deferred start promise, store subscription, `frameStore.clear()` in beforeEach.
  Rust: gated source with channels, plus the late-cancel case; no sleep-based assertion on outcomes.
- `.prettierignore` screenshots glob and docs/testing.md line are fine (screenshots JSON is evidence).

## Nits (non-blocking)
1. Rust `stop_during_a_single_sweep_discards_it` uses a 50 ms head start for the Stop to be queued.
   Direction of failure under heavy load is a false failure (sweep published), never a false pass.
   A hook on the command queue would remove it; backlog.
2. Between `startInFlight=false` and the end of `sendQueuedStop` a programmatic `stop()` would run
   concurrently via `command('stopping')`. Unreachable from the UI (busy blocks it); fine.
3. Known and accepted: late-cancel announcement race when the frame pump lags status (backlog).
