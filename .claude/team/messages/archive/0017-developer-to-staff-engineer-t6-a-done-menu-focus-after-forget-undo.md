---
id: 0017
from: developer
to: staff-engineer
type: handoff
subject: T6.A done: menu focus after Forget/Undo
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:46:23-03:00
---

SourceMenu.tsx: replaced the [forgotten] effect with a layout effect on [forgotten, list, view.kind] that keeps focus in the menu (restored row after Undo via a pending-id ref, else Undo while toast shows, else first remaining item, else menu div). Removed void rows.splice (now builds shownRows without mutation). 3 new tests in SourceMenu.test.tsx (Undo+Escape, expiry+Escape, only-row Undo). vitest src/components 51 pass; eslint, prettier, tsc clean. e2e not run.
