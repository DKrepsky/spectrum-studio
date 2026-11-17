---
id: 0157
from: developer
to: product-manager
type: handoff
subject: T0 before set captured (58 new shots, 98 PNGs)
work: 009-design-system
reply-to: 
date: 2026-11-16T19:06:01-03:00
---

T0 done: the visual e2e spec has 58 new shots, and the before set is in
.claude/team/work/009-design-system/evidence/before/ (98 PNGs: 58 new, 40 existing).

Files changed (uncommitted):
- e2e/specs/visual.e2e.ts (the only tracked change from T0; no src/ changes)
- .claude/agent-memory/developer/e2e-quirks.md (memory only)
- evidence/before/*.png (generated, ignored by ESLint and Prettier)

Shots (names stable, {real} = web view innerWidth):
- Side panel, at 1440 and 1024: measurement, markers-two, peaks-rows, invalid-field, display,
  source-settings (12).
- Source menu, at 1440 and 1024: Undo toast, keyboard focus (4).
- Status bar and plot tag at 1440, 1257, 1180, 1024: no-source, no-frame (Stopped), live, hold,
  connecting (injected) (20).
- Zoom reset at 1440 and 1024 (2).
- Capture control at 1440 and 1024: unavailable, idle continuous (teal), idle single (violet),
  acquiring continuous, keyboard focus (10). Plus single capturing (injected) at 1440 and 1024 (2).
- Plot tag waiting (injected) at 1440 and 1024 (2).
- Banners at 1440 and 1024: connect failed with Reconnect (real), warning (injected), lost device
  with Reconnect (injected) (6).

Not produced (and why):
- Stale plot tag ("No data for N s"): needs a stale trace; the sim cannot stop producing frames
  while acquiring, and injection clears frames.
- Command-error banner: no UI path to a failed command without a notice in the simulator.
- Reduced motion: no way to set prefers-reduced-motion in WebKitGTK from the test.
- Unavailable select: ParamForm has no unavailable choice state, and the sim has no choice params.
- Add dialog testing and saving states: not added (timing; would need a slow connect).
- 1257 is covered only for the status bar.

Spec results: npm run check exit 0. The visual spec: 46 passing, 1 failing. The failing test is
the documented known defect (hover actions cover the badge, source.css), which was already red on
main before my change. Also fixed: 3 pre-existing failures in the source-button width test (a race
after a failed connect, fixed with waitForLaunchSettled).

Deviations: none from the task scope. src/ untouched. Nothing committed.

Notes for design: the injected connecting state shows plot tag "No source connected" while the status
bar says "press Play", and the invalid-field shot is hard to read because the focus ring hides the
invalid colour.
