# 004 Reliable SA430 connection after plug-in
Status: accepted (2026-11-09)

As an SA430 user, I want the app to connect to the analyzer on the first try after I plug it in,
so that I don't have to unplug/replug or retry several times.

## Problem (reported by the human)
Right after plugging the module in, connecting fails with:
"Could not connect to TI SA430 spectrum analyzer: /dev/ttyACM0 did not answer like an SA430 (device
error executing 'Send address and size, get flash content': No frame start (0x032D)). Unplug and
reconnect the analyzer, then try again."
A subsequent attempt then fails with a timeout. This happens every time the module is plugged in.

## Acceptance criteria
- [ ] Root cause is identified and written down (plan.md): why the first command after plug-in gets
      no frame start, and why the following attempt times out (e.g. stale bytes in the CDC buffer,
      device still booting, half-consumed frame left from the failed attempt, port not released).
- [ ] Given the SA430 has just been plugged in, when the user picks it in the source menu, then the
      app connects without the user having to retry (driver resynchronises: flushes/drains the port,
      waits for the device to be ready, and retries the identification handshake with bounded backoff).
- [ ] Given a connect attempt failed, when the user tries again, then the next attempt does not fail
      with a timeout caused by leftover state of the previous attempt (port fully released / link resynced).
- [ ] Retries are bounded: a port that is not an SA430 or a dead device still fails with a clear,
      actionable message within a bounded time (target ≤ ~6 s total), never hangs.
- [ ] The UI keeps showing the backend's connecting state during retries; success/failure comes only
      from SessionStatus (no UI assumptions).
- [ ] Unit tests (scripted/mock backend) cover: fails-then-succeeds on retry, persistent failure gives
      up with the clear message, timeout-then-success. `npm run check` green.
- [ ] QA verifies on the real SA430 on this machine: repeated connect/disconnect cycles (≥10) all
      succeed first try; plug-in-then-connect verified with the human's help (QA cannot replug).
- [ ] If the fix involves the `sa430` protocol crate behaviour, the change is either made in the
      driver crate around it or documented (ADR if a significant decision).

## Out of scope
- Automatic reconnect when the device is unplugged mid-acquisition (separate backlog item).
- Any UI redesign; error copy may be adjusted only if a final failure message changes.
- Other drivers.

## Notes / constraints
- Hardware specifics stay in `crates/spectrum-driver-sa430/` (or the `sa430` crate); session/UI must not
  learn about SA430 retries.
- Never report a connection as successful unless the calibration/identification actually succeeded.
