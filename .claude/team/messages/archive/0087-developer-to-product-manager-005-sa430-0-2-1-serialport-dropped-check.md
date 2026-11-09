---
id: 0087
from: developer
to: product-manager
type: handoff
subject: 005 sa430 0.2.1: serialport dropped, checks and hardware green
work: 005-sa430-lib-0.2.1
reply-to: 
date: 2026-11-09T20:41:03-03:00
---

Implemented story 005 (not committed; working tree only).

Files
- Cargo.toml: `sa430 = "0.2.1"` (Cargo.lock: sa430 0.2.0 -> 0.2.1; serialport stays only transitively via sa430)
- crates/spectrum-driver-sa430/Cargo.toml: `serialport` dependency removed
- crates/spectrum-driver-sa430/src/lib.rs: SerialBackend::open uses `SerialPortChannel::with_settle(port, policy.settle)`; SerialLink wraps SerialPortChannel and calls `set_timeout` per read (handshake timeout capped by deadline, 5 s once sweeping); BAUD_RATE const removed; test `denied()` uses `sa430::SerialError::new(PermissionDenied, ..)`. Retry logic, messages and policy unchanged.
- docs/adr/0012-sa430-connect-handshake.md: decision, consequences and status amended for 0.2.1.
- docs/sources.md: connect paragraph now says the port comes from sa430's with_settle, no direct serialport.

Checks
- `grep -rn serialport --include=Cargo.toml .`: no output.
- `npm run check`: exit 0. Driver unit tests 25 passed, session tests 10 passed (1 ignored), all workspace tests green, eslint/tsc/vitest green. One rustfmt line wrap was needed (formatting only) and applied before the final run.
- Hardware (`SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430 --test hardware -- --ignored --test-threads=1 --nocapture`), no Spectrum app running (pgrep empty), device /dev/ttyACM0, serial 08FF41E50F8B3A34:
  - connect_then_sweeps_return_calibrated_traces: ok (3 sweeps of 101 points, ~111 ms each, max -68.0 dBm)
  - discovery_is_stable: ok (USB firmware 0104)
  - reboot_then_connect_succeeds_with_the_default_policy: ok, port vanished 5.2 ms, back 656 ms, connected in 381 ms with 2 attempts
  - reboot_then_connect_without_settle_recovers_within_the_policy: ok, connected in 181 ms with 2 attempts
  - ten_connect_cycles_all_succeed_on_the_first_attempt: ok, all 10 cycles 1 attempt, ~228-230 ms each
  - usb_serial_equals_calibration_serial: ok
  - Result: 6 passed, 0 failed.
- Hardware run was before the rustfmt-only change; no behaviour difference.

Open notes
- Test name `reboot_then_connect_without_settle...` is from 004 and unchanged; the reboot tests show 2 attempts (the first open is usually denied by udev), as in the 004 notes.
- Not committed. Untouched: the PM's own memory file and the untracked work folder were already dirty before I started.
