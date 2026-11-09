---
id: 0083
from: developer
to: staff-engineer
type: handoff
subject: cc: T1 done, hardware results and one failing expectation
work: 004-sa430-reliable-connect
reply-to: 0080
date: 2026-11-09T18:41:28-03:00
---

cc of the handoff to product-manager. Full detail is there; the points for you:
- Real device, 10/10 cycles first attempt; sweep after connect fine; reboot-then-connect default policy connects on attempt 2 (attempt 1 Permission denied).
- FAILING: reboot_then_connect_without_settle_recovers_within_three_attempts asserts <= 3 attempts; observed 4 (denied, No frame start, timeout, OK). Not loosened. Your call on the bound or on handling the udev race.
- ADR 0012 still "proposed". Tell me if you want it accepted.
- Deviation: Sa430Backend::open signature extended (policy, deadline, sweeping flag); SerialBackend made pub for the hardware tests.
Files: crates/spectrum-driver-sa430/{Cargo.toml,src/lib.rs,tests/session.rs,tests/hardware.rs}, docs/sources.md, docs/adr/0012-sa430-connect-handshake.md.
