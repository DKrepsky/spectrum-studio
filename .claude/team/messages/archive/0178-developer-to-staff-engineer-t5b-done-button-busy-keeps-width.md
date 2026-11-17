---
id: 0178
from: developer
to: staff-engineer
type: handoff
subject: T5b done: Button busy keeps width
work: 009-design-system
reply-to: 
date: 2026-11-16T19:43:34-03:00
---

T5b implemented per tasks/T5b.md. Files: src/ui/Button/Button.tsx, Button.css, Button.test.tsx only (Spinner untouched).

What changed:
- Label is always wrapped in `span.ui-button__label`.
- Busy without icon: `span.ui-button__overlay` (absolute, inset 0, centred, aria-hidden) holds the Spinner over the label; the label gets `ui-button__label--masked` (color: transparent).
- Busy with icon: the Spinner replaces the icon inside `span.ui-button__lead`, now a fixed 12px x 12px slot (idle icons use the same slot).
- Spinner inside lead/overlay uses `color: inherit` (readable on primary).
- `.ui-button` gets `position: relative`.

Tests added (Button.test.tsx): same label node and name idle vs busy; overlay without icon; spinner in icon slot with icon and label visible; CSS contract (overlay absolute, inset 0, label masked transparent, lead 12px, button relative, spinner inherits colour).

Checks: `npm run check` exit 0 (454 tests passed, 47 files; prettier, eslint, tsc, cargo unchanged). Bindings unchanged. Not visually screenshotted (T10 covers Save busy in the dialog).

Deviations and why:
1. Masked label uses color: transparent, not visibility: hidden. Browsers drop visibility:hidden text from the accessible name, which would make a busy button nameless. The task asked that the name stay the label.
2. The task text says "visible label stays" but also prefers the overlay over a hidden label. I followed the explicit preference (no icon: overlay on a masked label). If the designer wants the label visible while busy, the alternative is spinner in the left padding; say so and I will change it.
3. Idle icon buttons now have a 12px icon box (was unsized). Glyphs wider than 12px would overflow; none in use.

Left undone: none within scope. Nothing committed.
