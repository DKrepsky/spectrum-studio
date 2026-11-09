---
name: feedback-small-tweaks
description: Small UI tweaks can skip designer/prototype; go dev → QA (visual) → human acceptance
metadata:
  type: feedback
---

For small, precisely specified UI tweaks (e.g. work 002 source-row polish), a short story → developer → QA with
screenshots in the real app → human acceptance was enough; the human accepted and asked to commit directly.

**Why:** the human gave an exact spec; the full design stage would have added nothing. QA still caught a keyboard
regression (hiding with visibility:hidden broke arrow-key focus), so visual + keyboard QA stays mandatory.
**How to apply:** skip designer/staff-engineer only when the request is precise and CSS/markup-only; always state the
defaults chosen; offer "Accept and commit" at the gate. Related: [[feedback-acceptance-process]].
