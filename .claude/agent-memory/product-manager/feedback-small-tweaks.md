---
name: feedback-small-tweaks
description: Small UI tweaks can skip designer/prototype; go dev → QA (visual) → human acceptance
metadata:
  type: feedback
---

For small, precisely specified UI tweaks (work 002 source-row polish, work 003 Play/Pause button), a short story →
developer → QA with screenshots in the real app → human acceptance was enough; the human accepted and asked to commit
directly (both times picked "Accept and commit"). For 003 the human accepted PM-chosen defaults stated up front
without objecting (Pause = stop acquisition with frozen trace; whole state pill removed; Play no auto-connect).

**Why:** the human gave an exact spec; the full design stage would have added nothing. QA still caught real issues
(002: keyboard focus regression; 003: focus lost after keyboard toggle, stale copy, hover colour), so visual +
keyboard QA stays mandatory. QA also corrected a developer's wrong "this regression is new" claim by measuring baseline.
**How to apply:** skip designer/staff-engineer only when the request is precise and UI-scoped; state defaults in the
first reply and proceed without blocking; offer "Accept and commit" at the gate; commit includes work-folder screenshots.
Related: [[feedback-acceptance-process]].
