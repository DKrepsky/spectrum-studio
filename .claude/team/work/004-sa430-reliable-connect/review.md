# Review: 004 T1 (SA430 reliable connect)

Verdict: approved. `npm run check` green; hardware suite 6/6 passed on the real SA430.

## Checked
- Boundaries: `serialport` and all SA430 specifics stay in `crates/spectrum-driver-sa430`; nothing in `src-tauri`, core or UI (only `Sa430Driver` is registered). `sa430` crate untouched. New dependency justified (same major as `sa430`, one copy) and in ADR 0012.
- Sweep timeout: `SerialLink::read` switches to 5 s once `sweeping` is set after the calibration read; unit-tested (`read_timeout`), sweeps verified on hardware.
- Dead/non-SA430 port: attempts 4 x (200 settle + 600 read) + 1.05 s backoff is about 4.3 s, reads capped by the 6 s deadline; no attempt starts that cannot finish inside the deadline. Message unchanged ("did not answer like an SA430 ... Unplug and reconnect"), cause attached.
- Missing dialout: PermissionDenied is retried (about 1 s extra), the final error keeps the `open_error` dialout hint (unit test asserts it).
- Serial mismatch and non-retryable errors: single attempt (tests). Each failed attempt drops its device (drop-counter tests).
- No unwrap outside tests; docs/sources.md updated.

## Open points
1. Zero-settle test: changed to assert success within the default policy's max attempts (4) and within the deadline; renamed `..._recovers_within_the_policy`. Observed 4 attempts, 1.69 s. No defect: without settle the device needs the retry ladder by design.
2. First-attempt PermissionDenied after reboot (udev race): no pre-wait added. It is retried transparently, default policy connected in 381 ms on attempt 2, and a wait-for-node would add a polling loop and a timing heuristic for no user-visible gain.
3. ADR 0012 set to accepted.

## Hardware output (default policy)
10/10 connect cycles first attempt (~229 ms each); reboot-then-connect default: 2 attempts, 381 ms; without settle: 4 attempts, 1.69 s; 3 sweeps ~111 ms each; USB serial equals calibration serial.

## Minor notes (no action)
- `Sa430Backend::open` signature grew (policy, deadline, sweeping flag); acceptable, backend trait is driver-internal.
