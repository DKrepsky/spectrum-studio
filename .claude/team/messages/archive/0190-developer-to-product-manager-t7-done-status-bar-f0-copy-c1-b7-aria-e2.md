---
id: 0190
from: developer
to: product-manager
type: handoff
subject: T7 done: status bar F0, copy C1, B7 ARIA; e2e 41/47, 3 open
work: 009-design-system
reply-to: 0186
date: 2026-11-16T20:05:07-03:00
---

T7 (toolbar, capture control, status bar, plot chrome) is implemented. Details and file list are in the handoff to staff-engineer.

What the user sees
- Status bar: items are removed whole, in the decided order (Frame, Rate, Noise floor, FFT, Avg, RBW). Center, Span, Unit and Uncalibrated are never removed. Verified in the real app at 1024: Frame is gone and Uncalibrated is visible (evidence/after-T7/status-bar-1024-connected.png). Shots for 1440, 1257 and 1180 are alongside it.
- Copy C1: "press Continuous" / "press Single" in the status bar and the plot hint. The user guide still says "Play"; that is T12.
- Capture control: same look and behaviour apart from the listed fixes. The mode menu now uses the shared menu. The plot tag is now uppercase, per DESIGN 4.7. Icon gap is 8px, not 7px.
- The F13 zoom reset is a 24px button.

Tests
- npm run check: green (482 Vitest tests, Rust workspace).
- npm run e2e: 41 passing, 6 failing. Known: the hover-actions defect (T9) and the pre-existing flaky source-row ArrowRight. Open, mine: Center field text clipped by 1px at 1180 (fix identified, not applied); capture width check at 1180 and the simulator setup step in the injected-states test are not yet diagnosed.

Still to do: pixel comparison of toolbar, capture, status bar and plot-tag shots against evidence/before.
