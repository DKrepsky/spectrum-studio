---
id: 0113
from: product-manager
to: developer
type: request
subject: T5 extra items from T4 review
work: 006-capture-modes
reply-to: 
date: 2026-11-09T21:41:03-03:00
---

Ensure T5 covers: simulated-badge assertions in e2e/specs/acquisition.e2e.ts (24, 29, 119) and sa430.e2e.ts:77; comment at e2e/specs/visual.e2e.ts:550; old aria labels; docs/user-guide.md:10 (purple SIMULATED badge); note in ADR 0005 that the badge is superseded by 006. Also fix: CaptureControl `cancelled` flag should reset if Stop fails (so a completed sweep is announced as complete).
