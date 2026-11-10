# BUG-1 root cause: SA430 single cancel "still shows a frame"

Author: staff-engineer. Verdict: **neither a late cancel nor a backend discard bug.** The Cancel
click is swallowed by the UI in the first ~10-25 ms after the press, so Stop is never sent and the
sweep completes normally. The backend discard is correct and was verified on the real device.

## Evidence (real SA430 08FF41E50F8B3A34, /dev/ttyACM0)

1. Sweep duration (101 points, 10 MHz, via `SessionManager`, throwaway probe, removed): a full
   single capture takes **111 ms** (110.8-113.0 ms in 4 runs).
2. Backend cancel (probe, `start()` then `stop()` after d ms, 3 runs each): d = 10, 30, 60, 100 ms:
   `stop()` returns at ~111 ms (it blocks until the in-flight read ends), state Connected, **no
   frame published (12/12)**. d = 150, 200 ms: the sweep was already done, the frame is
   published, `stop()` returns immediately: that is a legitimate late cancel. So the Rust side
   already honours the contract, including the `deferred = try_recv()` path.
3. Real app (debug build with temporary file probes in worker, `publish_frame`, status sink and
   the `start_acquisition`/`stop_acquisition` commands, plus an in-page MutationObserver; all
   probes removed afterwards). Press + an in-page `click()` on the button as soon as its label is
   "Cancel single capture", timestamps in epoch ms:
   - Click at 0 ms and 5 ms after the label flip (button `aria-disabled=true`): **no
     `cmd stop_acquisition` ever reached the backend**; `complete_single deferred=none`, frame
     published, UI shows frame +1. This reproduces QA's 4/5.
   - Click at 15, 30, 50, 80 ms after the label flip (`aria-disabled` already cleared), and 0-80 ms
     in the second batch once the window had closed: `cmd stop_acquisition entry`, then
     `complete_single deferred=Stop` -> `worker handle Stop`, **no `publish_frame`, frame count
     unchanged, state Connected (10/10)**, even with Stop arriving only 20 ms before the sweep end.
   Raw logs: `screenshots/bug1-ui-events-delayed-click.txt`,
   `screenshots/bug1-backend-probe-delayed-click.txt`.

## Timeline of one affected run (from the probe)

```
PRESS (click)                 t0
cmd start_acquisition entry   t0+2     worker: Start, read begin, status Acquiring
label -> "Cancel single..."   t0+3..12  (status event arrives BEFORE the invoke reply)
                                         button aria-disabled=true  (store.busy === 'starting')
in-page click                 t0+3..12  CaptureControl.onMain: `if (busyNow) return;`  -> DROPPED
aria-disabled cleared         t0+10..25  (start invoke resolved)
worker read end               t0+111    complete_single deferred=none -> publish_frame -> Connected
label -> "Start single..."    t0+115
frame appears in the UI       t0+115..    (long-poll next_frame, then store; ~0-50 ms later)
```

QA's 100 ms sampling made the frame look "100 ms after Connected". The sampling interval of the
timeline was ~108 ms (23, 134, 242, 349 ms), so the frame landed somewhere in (134, 242]; the
backend publishes the frame *before* the Connected status, and the UI only receives it through the
frame long-poll afterwards, so frame-after-status is the normal order for any finished capture and
not a discard bug.

## Cause

`src/components/capture/CaptureControl.tsx` `onMain`: `if (busyNow) return;` ignores every click
while a command is in flight. `session.ts` `command('starting', ...)` stays busy until the
`start_acquisition` invoke resolves, but the `Acquiring` status event reaches the webview earlier
and `mainView` already renders the "Cancel single capture" label/Stop icon. For ~10-25 ms the UI
shows a Cancel button that does nothing, and with a 111 ms sweep a human (or QA's observer) hits
that window. It affects any capture (Continuous Pause too: a Pause click in that window is
dropped), but only single capture makes it visible, because the result is a frame instead of a
silent no-op.

Violates the UI rule "the UI reflects backend state": it advertises an action the store then
refuses. The Rust worker needs no change.

## Contract (intended)

1. After the user cancels a single capture, no frame from that capture is ever shown. A Stop that
   the backend has received before the sweep is published discards the sweep, including a sweep
   that finished while the Stop was still in the channel (already implemented in
   `complete_single`).
2. A sweep that was published before the backend received Stop is a legitimate completed capture
   (late cancel); the UI must then end as completed, not "cancelled".
3. A Cancel (or Pause) click on a control that is labelled Cancel/Pause is never lost: if the
   `start` command is still in flight, the Stop is sent as soon as the start has resolved (queued,
   in order), not dropped. Clicks while a Stop is already in flight stay ignored.

## Fix

See `tasks/T7.md`: serialise commands in the store and let the main button queue a Stop behind an
in-flight Start. Frontend only; Rust unchanged apart from one deterministic regression test that
pins the discard contract.

## Secondary observations (not bugs in scope)

- `stop()` blocks until the in-flight read ends (<= sweep time, 111 ms here), so after a Cancel the
  button is busy ("stopping") for up to a sweep. Acceptable for the SA430; for a much longer sweep
  (large span / small RBW) the UI would look unresponsive for that long. Follow-up for the PM
  (interruptible reads), not in this fix.
- A Stop that arrives after the sweep was published (late cancel) leaves `cancelled=true` in
  `CaptureControl`, so the live region says "Single capture cancelled" although a frame was shown.
  T7 covers it (contract point 2).
