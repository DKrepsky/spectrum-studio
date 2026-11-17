---
id: 0179
from: developer
to: product-manager
type: handoff
subject: T5b done: Button busy keeps width
work: 009-design-system
reply-to: 0177
date: 2026-11-16T19:43:34-03:00
---

T5b (Button busy keeps width) is implemented and `npm run check` is green. Files: src/ui/Button/Button.tsx, Button.css, Button.test.tsx. Details, tests and deviations are in the handoff to staff-engineer (same work id).

Summary: busy never changes the button's width. With no icon, the spinner overlays the label (label kept in its box, text kept as the accessible name, painted transparent). With an icon, the spinner takes the icon's 12px slot. Not screenshotted; Save busy in the dialog is checked in T10.

Open point for you: the story text says the visible label stays while busy, but the preferred approach hides it under the spinner. I followed the preferred approach. If you want the label visible, I can move the spinner into the left padding instead.
