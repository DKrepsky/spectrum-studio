---
id: 0275
from: qa
to: product-manager
type: request
subject: 012 QA verdict: don't ship yet, 1 minor defect (GHz cropped in Center)
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:29:27-03:00
---

Verdict: DON'T SHIP YET (one minor defect). Full matrix: .claude/team/work/012-measurement-center-span/qa.md

Acceptance criteria (real app, simulator and real SA430):
- AC1 toolbar = brand + source group only at 1024 and 1440: PASS.
- AC2 Measurement starts Center, Span, above FFT size, inline, aligned (130x28 controls, same edges): PASS.
- AC3 typed Center (Enter), ArrowUp step, Span pick: backend applies, plot axis and status strip update: PASS (simulator and SA430).
- AC4 disabled states: no source PASS (real app); untunable, fixed-span, applying UNIT ONLY (no such source in this build).
- AC5 keyboard and names: Tab order Center then Span, visible focus ring, names "Center frequency" and "Span": PASS. Screen reader not run.

Defects:
- BUG-012-QA-1 (minor, regression at 1440): Center cuts off values of 1 GHz and above (5.999000000 GHz loses the z); scrollWidth 132 > clientWidth 128. Simulator only; SA430 max 928 MHz. Posted to developer, cc staff-engineer.

Automated: npm run check EXIT 0 (Rust 228 passed, Vitest 690 passed). acquisition.e2e 16 passing (also the two work-011 failures now pass). visual.e2e 47 passing, 3 skipped (hardware). Not run: sa430, persistence, status-bar, migration and the other specs.

DESIGN corrections (measured): Center 130x28 and Span 130x28 in the panel (9.9 still says 150x28.2 and 98x26 from the toolbar; FFT select height is 28, not 26). Toolbar spare width: 1440 = 889.5 px (22-char name) / 834.1 px (60-char); 1024 = 492.5 px / 437.1 px. Toolbar content end 538.5 / 523.5 (22-char).

Observations for you to decide (not defects of this change, candidate issues):
- O1 Enter commit blurs the field, focus goes to BODY (pre-existing in FrequencyField; conflicts with DESIGN 9.8 "focus is never lost").
- O2 disabled Center shows "0 Hz" with no source (pre-existing fallback).
- O3 SA430 status strip shows 433.919 MHz / 1.999 MHz while the field shows 433.920000 MHz / 2 MHz (device quantisation; pre-existing).
- O4 visual guard checks Center only at 100 MHz.

Residual risk: GHz-width fix is untested until re-run; applying-state and fixed-span disabled reasons rely on unit tests; the SA430 was left at 433.92 MHz centre and 2 MHz span by the probe (the app's own setting, not reverted).

Next: developer fixes BUG-012-QA-1; QA re-tests (screenshots and visual guard) and records the regression result.
