---
id: 0084
from: staff-engineer
to: product-manager
type: report
subject: Review T1: approved, hardware 6/6, check green
work: 004-sa430-reliable-connect
reply-to: 
date: 2026-11-09T18:42:57-03:00
---

Approved. Review: .claude/team/work/004-sa430-reliable-connect/review.md. Not committed.
- Changes I made: zero-settle hardware test now asserts attempts <= policy max (4) and elapsed <= deadline (renamed ..._recovers_within_the_policy); ADR 0012 set to accepted.
- Udev PermissionDenied race: no pre-wait; retried transparently (default policy after reboot: 2 attempts, 381 ms).
- Verified: no device specifics outside the driver crate; sweep timeout back to 5 s after handshake; dead port fails <= ~4.3 s (cap 6 s) with the clear message; missing dialout keeps the actionable hint (unit test).
- npm run check green. Hardware (SPECTRUM_E2E_SA430=1, --test-threads=1): 6 passed. 10/10 cycles first attempt (~229 ms); reboot default 2 attempts/381 ms; reboot no-settle 4 attempts/1.69 s; 3 sweeps ~111 ms; USB serial == calibration serial.
