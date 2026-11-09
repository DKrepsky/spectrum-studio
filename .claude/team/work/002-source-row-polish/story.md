# 002 Source menu row polish
Status: accepted
As a user picking a source, I want a calm source list where the transport tag is centred and the
edit/forget buttons only appear when I hover a row, so that the list is easy to scan.

## Acceptance criteria
- [ ] The transport tag ("USB", "Built-in", …) is vertically centred in its row, for two-line
      rows and single-line rows (fixed items such as Simulator).
- [ ] Edit (✎) and Forget (×) buttons are not visible when the menu opens, including on the row
      that has keyboard focus/highlight.
- [ ] Hovering a row reveals its buttons with a short slide-in from the left (~150 ms); leaving the
      row hides them again.
- [ ] Both buttons are vertically centred in the row and aligned with each other; they occupy the
      tag column (the tag is hidden/faded while they show) and never overlap the name or line-2 text.
- [ ] With `prefers-reduced-motion: reduce` the buttons appear without sliding.
- [ ] Keyboard still works: F2 / Delete shortcuts unchanged; if keyboard focus lands on an action
      button itself, that button's actions are visible (so focus is never invisible).
- [ ] Long device names still ellipsize; row heights unchanged.
- [ ] `npm run check` passes; existing SourceMenu tests pass (updated only if the DOM contract changes).

## Out of scope
Any change to menu behaviour, ordering, copy or the Add/Edit dialog.

## Notes
CSS-only expected (`src/styles/source.css`, `SourceRow` in `src/components/source/SourceMenu.tsx`).
