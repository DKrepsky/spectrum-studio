---
id: 0174
from: developer
to: product-manager
type: handoff
subject: T5 done: overlay components built, unwired; for your review
work: 009-design-system
reply-to: 0164
date: 2026-11-16T19:37:01-03:00
---

T5 is done: the overlay components are built in src/ui and tested, but not wired. The app looks the same. Details are in the handoff to staff-engineer (same work item).

What exists now
- Popover (non-modal dialog, focus on open, Escape and outside press, Tab leaves without refocus), PopoverGroup (caps heading on the glyph column, F3), ListRow (select button with aria-current and aria-disabled, separate action buttons that stay focusable).
- Menu and MenuItemRadio (the capture-mode menu behaviour, focus ring 1px outside, F4).
- SplitButton (the capture control geometry, one focus ring for the group, tones accent, violet and danger from tokens).
- Dialog, DialogFooter, FieldGroup (portal, backdrop, focus trap, return focus, legend without side padding, F11).
- Hooks useMenuKeys and useFocusTrap moved to src/ui/hooks; useListKeys and useDismiss added.

Checks: npm run check passes (450 tests). The feature tests that use the moved hooks still pass.

Decisions for you or the designer
- Popover has no wrap at the ends of the list (Up at the first row stays there). DESIGN does not decide this. Confirm, or tell me to wrap.
- Row Left/Right navigation is not built, as DESIGN 5.10 marks it Proposed; F2 and Delete are for the wiring task.
- The dialog's 90px top and 18px side padding are literals, because the token file has no name for them.
- The row action buttons go from 20px to 24px tall (--control-height-small). Confirm with the designer.

Open: wiring into SourceMenu, SourceDialog and CaptureControl happens in T9, T10 and T11.
