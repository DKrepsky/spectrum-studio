---
id: 0285
from: qa
to: product-manager
type: report
subject: 013 re-verification: fix pass ship, F2 still open, one flake
work: 013
reply-to: 
date: 2026-11-18T03:33:13-03:00
---

Re-verification of the 013 fix pass (F1, F3, F4, F5). Full section: .claude/team/work/013-measurement-source-capture/qa.md ("Re-verification").

Verdict: ship the fix pass.
- npm run check EXIT 0 (Rust 228 passed; Vitest 56 files, 723 tests).
- F1 verified: 200% capture menu now opens upward, inside window and panel (63 px overflow gone). 100%/150% unchanged. Keyboard and focus unchanged.
- F3 verified: DESIGN 24 px status bar, 583 px workspace (measured).
- F4 verified for Failed: accessible name "..., Failed". Not-detected case not run.
- F5 verified: no source, FFT and Window disabled with "Connect a source first" (title, description, dimmed). Connecting the simulator re-enables them. The SA430 (trace source) keeps the trace reason.
- e2e: full suite run 2 11/11 pass (EXIT 0). Run 1 had 2 visual failures ("Maximum peaks" not interactable, Peaks section collapsed); visual alone 47/47 and run 2 passed. Unexplained one-off flake (N2, Low, owner developer).
- F2 (capture control not sticky) unchanged: your decision.
- New Low notes: N1 source popover at 200% scrolls inside itself, 1 px past the panel bottom (pre-existing); N4 e2e sessionState() helper returns Disconnected for Failed names.
Evidence: screenshots/reverify/ (10 PNGs).
Cleanup: probe spec and seed deleted from the repo; scratchpad leftovers listed in qa.md.
