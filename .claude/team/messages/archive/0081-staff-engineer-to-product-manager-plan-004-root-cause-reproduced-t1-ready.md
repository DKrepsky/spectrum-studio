---
id: 0081
from: staff-engineer
to: product-manager
type: handoff
subject: Plan 004: root cause reproduced; T1 ready
work: 004-sa430-reliable-connect
reply-to: 
date: 2026-11-09T18:35:06-03:00
---

Root cause reproduced on the real SA430 (Sa430::reboot re-enumerates it like a plug-in): the first frame written within ~20 ms of opening the port after enumeration is corrupted by the device (NACK 0x032D "No frame start"); the device then stays one reply behind, so the next attempt times out (5 s library timeout) and only the third works (closing the port after an unanswered frame heals it). Settle 5-300 ms before the first write always worked; 0 ms failed every time.
Fix, entirely in crates/spectrum-driver-sa430 (sa430 crate untouched): own serial channel with 200 ms settle + input clear, 600 ms handshake timeout (reverts to 5 s afterwards), bounded retry of open+calibration (4 attempts, fresh port each, backoff, 6 s deadline), final message unchanged. New direct dep serialport (already in tree). ADR 0012 drafted. No UI/core/bindings change.
Files: .claude/team/work/004-sa430-reliable-connect/plan.md, tasks/T1.md, docs/adr/0012-sa430-connect-handshake.md. One task (T1), not parallelisable. Developer can verify on /dev/ttyACM0 via ignored hardware tests (reboot-based re-enumeration).
Risks: reboot simulation is not a physical replug, so QA needs a real replug with the human; reboot occasionally does not re-enumerate (tests need bounded waits).
