---
name: frequency-escape-stale-draft
description: Old FrequencyInput commits a valid draft on Escape (blur reads stale closure); new fields read the draft from a ref
metadata:
  type: project
---

The legacy `src/components/FrequencyInput.tsx` commits a valid draft when Escape is pressed. Escape calls
`setDraft(null)` then `blur()`, and the onBlur handler still sees the pre-Escape draft (stale closure), so
`onCommit` fires. Verified with a scratch test (deleted).

**Why:** React batches state, so the blur dispatched inside the key handler runs with the last committed render.
**How to apply:** in `src/ui/Field/NumberField.tsx` and `FrequencyField.tsx` the commit path reads a `draftRef`
that is updated synchronously in `setDraft`. Any new edit-on-blur control should do the same. The legacy
component is deleted in T7, so do not port its pattern.
