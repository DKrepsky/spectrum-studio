---
id: 0168
from: developer
to: product-manager
type: handoff
subject: T3 done: controls built, unwired (Button, IconButton, Spinner, InlineMessage, Field family)
work: 009-design-system
reply-to: 0162
date: 2026-11-16T19:34:56-03:00
---

T3 (controls) is built and tested, unwired. No screen changed. Details and props for the staff engineer are in the handoff to staff-engineer on the same work item.

Built: Button (default/primary/destructive, small, busy, unavailable), IconButton (required label, ghost/filled, unavailable), Spinner, InlineMessage (hint/note/info/warn/error), Field, TextField, NumberField, FrequencyField, Select, Checkbox, all under src/ui/. All CSS uses tokens only.

Behaviour to be aware of for QA and design:
- Busy button: the spinner takes the icon's place (or is added before the label). A label-only button gets slightly wider while busy. DESIGN 4.1 asks for unchanged width. This is open: reserve the slot, or accept it.
- Number and frequency fields: Enter keeps an invalid entry visible, blur reverts it, Escape reverts. This is DESIGN 4.4. The old frequency field committed a valid entry on Escape; the new one does not. QA should check this when wired.

Checks: 82 new tests pass; my folders lint and format clean. `npm run check` is red only on other tasks' files: Dialog.test.tsx, Popover.tsx, SplitButton.test.tsx (lint, tsc) and SplitButton.css (token test). Not mine, not fixed.
