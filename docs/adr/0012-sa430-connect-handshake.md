# ADR 0012 — SA430 connect: settle after open and bounded retry

Status: accepted (2026-11-09)

## Context

Right after the SA430 enumerates (plug-in), the first frame written within ~20 ms of opening
the port is corrupted on the device side: it answers with NACKs (`No frame start`, 0x032D) and
stays one reply behind until the port is closed after a further unanswered request. With the
`sa430` crate (`Sa430::open`: no settle delay, 5 s read timeout) the user saw: first connect
`No frame start`, second connect a 5 s timeout, third connect fine. Evidence and measurements:
`.claude/team/work/004-sa430-reliable-connect/plan.md`.

## Decision

- The driver opens the serial port itself (`serialport`, same line settings as the library),
  waits 200 ms, clears the input buffer and hands the channel to `Sa430::new`. The `sa430`
  crate is unchanged.
- The open + calibration handshake uses a 600 ms read timeout and is retried up to 4 times
  (fresh port each time, backoff 150/300/600 ms, 6 s overall deadline). Retried failures are
  timeouts, device/protocol errors and a busy (`PermissionDenied`) or vanished (`NoDevice`) port
  at open; a serial mismatch is not retried. Every handshake read is also capped by the time left
  before the deadline, so the bound holds without estimating worst-case attempt times. The
  channel returns to the library's 5 s timeout once the handshake succeeded.
- Retry logic stays in the SA430 driver; the session and UI only see `Connecting`, then
  success or the final error.

## Consequences

- First connect after plug-in succeeds without user retries; a dead port fails in <= 6 s.
- `serialport` becomes a direct dependency (already in the tree through `sa430`).
- Every connect pays the 200 ms settle. We do not detect "first open".
- The settle does not cover the udev permission race: after the node reappears, the first open can
  still fail with `PermissionDenied` (seen on the reboot test), which the retry absorbs.
- Measured on the real device after a reset: the default policy connected on attempt 2 (attempt 1
  denied); with no settle, attempt 2 hit "No frame start" and attempt 3 timed out before attempt 4
  succeeded. The retry ladder is therefore needed, not only the settle.
- If upstream `sa430` later offers a settle/timeout hook, the wrapper can be dropped.
