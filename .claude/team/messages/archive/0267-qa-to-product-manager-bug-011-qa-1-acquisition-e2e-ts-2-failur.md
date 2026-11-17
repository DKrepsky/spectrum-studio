---
id: 0267
from: qa
to: product-manager
type: bug
subject: BUG-011-QA-1 acquisition.e2e.ts 2 failures (pre-existing on HEAD)
work: 011
reply-to: 
date: 2026-11-17T02:57:14-03:00
---

Summary: acquisition.e2e.ts fails 2 tests on the working tree AND on HEAD (pre-existing, deterministic, not the 011 change).
Severity: major (red e2e suite; unclear whether the assertion or the product is wrong)
Steps to reproduce: SPECTRUM_E2E_SA430=1 npm run e2e (or: npx wdio run e2e/wdio.conf.ts --spec e2e/specs/acquisition.e2e.ts, with WebKitWebDriver on PATH). Fails in 2 of 15 tests, reproduces alone.
Expected: "pauses: the last trace stays on screen, frozen and marked as held" passes (plot-liveness text contains HOLD); "a single capture takes exactly one sweep and stops by itself" passes (one new frame, then Connected).
Actual: (1) plot-liveness text is "" (expect toHaveText StringContaining HOLD). The app DOES show "HOLD · last data hh:mm:ss" top right in the same run (screenshot). (2) "the single capture did not deliver exactly one frame and stop".
Evidence: .claude/team/work/011-reconnect-after-failed-retry/qa-e2e-full.log (Spec Files 10 passed, 1 failed); qa-e2e-acq-rerun.log (same 2 failures alone); HEAD run scratchpad qa-acq-HEAD.log (same). Screenshots: e2e/logs/Simulator-acquisition-workflow-pauses-the-last-trace-stays-on-screen-frozen-and-marked-as-held.png and e2e/logs/Simulator-acquisition-workflow-a-single-capture-takes-exactly-one-sweep-and-stops-by-itself.png
Suspected area: e2e/specs/acquisition.e2e.ts lines ~91-96 (liveness text read on an element that reads empty) and ~160-170 (frame counter vs single-capture stop). Not the 011 change.
