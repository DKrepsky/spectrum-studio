---
id: 0082
from: developer
to: product-manager
type: handoff
subject: T1 done: SA430 settle + bounded connect retry (npm run check green)
work: 004-sa430-reliable-connect
reply-to: 0080
date: 2026-11-09T18:41:28-03:00
---

T1 implemented, uncommitted in the working tree. `npm run check` exits 0. Driver crate only; no UI, core, bindings or sa430 crate changes.

FILES
- crates/spectrum-driver-sa430/Cargo.toml: serialport = "4.8" (same 4.10.1 already in the tree; Cargo.lock +1 line)
- crates/spectrum-driver-sa430/src/lib.rs: SerialBackend opens the port itself (926100 8N1, no flow control), sleeps 200 ms, clears input, wraps the port in SerialLink; ConnectPolicy (Default: 4 attempts, settle 200 ms, backoff 150/300/600 ms, handshake timeout 600 ms, deadline 6 s); Sa430Driver::identify retry loop; with_backend_and_policy
- crates/spectrum-driver-sa430/tests/session.rs: scripted backend now a queue of links; 2 new session tests
- crates/spectrum-driver-sa430/tests/hardware.rs: 4 new #[ignore] tests (+ existing 2 kept)
- docs/sources.md (SA430: Connect bullet, Tests bullet)
- docs/adr/0012-sa430-connect-handshake.md: status left at "proposed" (plan does not say accepted); text updated with the deadline cap and measured findings

TESTS ADDED
- Unit (lib.rs, 25 pass): glitch then success; silent then success; glitch, silent, success (3 attempts); persistent failure gives up after exactly 4 opens with the clear message and drops all 4 devices; serial mismatch not retried; PermissionDenied retried, final message keeps dialout hint; unrecoverable open not retried; deadline 0 gives exactly one attempt; default policy budget arithmetic; backoff ladder; read-timeout table (handshake, deadline cap, sweep 5 s).
- Session (tests/session.rs, 10 pass + 1 ignored): glitched first connect is Connected and acquires; never-answering device gives Disconnected with the message, never Connected.

HARDWARE OUTPUT (real SA430 on /dev/ttyACM0, app not running, `SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430 --test hardware -- --ignored --test-threads=1 --nocapture`)
- ten_connect_cycles_all_succeed_on_the_first_attempt: PASS. 10/10 cycles, 1 attempt each, 228-230 ms per connect.
- connect_then_sweeps_return_calibrated_traces: PASS. 3 sweeps, 101 points from 428.920 MHz, bin 100 kHz, max -68.0 dBm, 110-112 ms each (sweep timeout works after the handshake).
- discovery_is_stable: PASS. usb_serial_equals_calibration_serial: PASS (08FF41E50F8B3A34).
- reboot_then_connect_succeeds_with_the_default_policy: PASS. Port vanished after 5-7 ms, came back after 655-660 ms, connected in 380 ms with 2 attempts (NOT 1 as expected). Attempt 1 failed at open with "Permission denied" (udev race right after the node reappears); attempt 2 succeeded.
- reboot_then_connect_without_settle_recovers_within_three_attempts: FAILED on its own <= 3 assertion. Connected in 1.69 s with 4 attempts: 1 Permission denied, 2 "No frame start", 3 timeout, 4 OK. The ladder recovers, but not within 3. I did not loosen the assertion; staff-engineer to decide the bound.

DEVIATIONS
1. Sa430Backend::open now takes (port, policy, deadline, sweeping flag). SerialBackend is pub so the hardware test can count opens. The sweeping flag is set after calibration succeeds, which reverts reads to 5 s.
2. Deadline is enforced at runtime: every handshake read is capped at the time left, and no attempt starts if its pauses and settle would pass the deadline. The "arithmetic" test asserts fixed overhead (pauses 1050 ms + settles 800 ms < 6 s), not attempts x worst case (which would be 6.65 s), since the cap makes that bound unnecessary.
3. PermissionDenied and NoDevice at open are retried; the plan listed both.
4. Not done: no roadmap change (not requested), no commit, GUI not run, no human replug test (QA/human).

OPEN
- The zero-settle hardware assertion (<= 3 attempts) fails as described above. Either the bound moves to 4, or the udev race needs its own answer. Staff-engineer, please decide.
- Reboot-based tests are not a physical replug; QA still needs the human replug test.
