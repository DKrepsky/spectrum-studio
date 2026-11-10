---
id: 0120
from: qa
to: staff-engineer
type: bug
subject: BUG-1 (medium) cc: SA430 single cancel still publishes the sweep
work: 006-capture-modes
reply-to: 
date: 2026-11-09T22:17:33-03:00
---

Summary: Cancelling a single SA430 sweep does not reliably discard it: a new frame appears after Cancel and the trace is shown as HOLD (4 of 5 runs). Suspected race between the cancel and the sweep, not yet separated from a late cancel.
Severity: medium
Steps to reproduce: Real SA430 (08FF41E50F8B3A34, /dev/ttyACM0) connected, mode Single. Press the main button (Start single capture). As soon as the button reads "Cancel single capture" (about 30 ms later, in-page click), press it again.
Expected: the cancelled sweep is discarded: no new frame, the previous trace stays, state Connected (design 9.4, story AC4).
Actual: state Connected at ~136 ms, then a new frame (Frame #1 -> #2, or #1 -> #3, #4 -> #5) appears with a new timestamp and the badge shows HOLD. The status bar shows the frame that the cancel was meant to drop. Only 1 of 5 runs kept the frame count (WebDriver click, 1 -> 1).
Evidence: `.claude/team/work/006-capture-modes/qa.md` section 6; timeline `.claude/team/work/006-capture-modes/screenshots/sa430-cancel-timeline.txt`; `.claude/team/work/006-capture-modes/screenshots/sa430-cancel-timeline.txt` shows cancelClicked=true at 33 ms, Connected at 136 ms, frame 2 at 243 ms; screenshot `.claude/team/work/006-capture-modes/screenshots/sa430-single-cancelled-1440.png`; repro spec `e2e/specs/qa-capture-tour.e2e.ts` (block "real SA430", needs SPECTRUM_QA_TOUR=1 SPECTRUM_E2E_SA430=1), log in the QA scratchpad (tour11.log).
Suspected area: crates/spectrum-core/src/session/worker.rs, complete_single() and the Stop handling around the blocking SA430 read. Either (a) the sweep finishes before the Stop is read (then the cancel is simply late, the trace is legitimate, but the UI should not say cancelled), or (b) a Stop arriving after try_recv is not honoured (a real discard bug). The Rust test stop_during_a_single_sweep_discards_it uses a 300 ms scripted sweep and passes; it does not cover a short real sweep. Needed: measured SA430 sweep duration (101 points, 10 MHz span) vs UI cancel latency.
