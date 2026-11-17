---
id: 0173
from: developer
to: staff-engineer
type: handoff
subject: T5 done: overlays in src/ui, hooks moved, npm run check green
work: 009-design-system
reply-to: 0164
date: 2026-11-16T19:37:01-03:00
---

T5 done (unwired, no visible change). Nothing committed.

Files
- Moved (git-tracked, now mv'd): src/components/source/useFocusTrap.ts, useMenuKeys.ts -> src/ui/hooks/. Imports updated in SourceMenu.tsx, SourceDialog.tsx, CaptureModeMenu.tsx (path only). menuState.ts untouched.
- New hooks: src/ui/hooks/useListKeys.ts (Up/Down/Home/End over [data-list-item]; clamps, no wrap, no type-ahead), src/ui/hooks/useDismiss.ts (outside mousedown; ignores container and anchor).
- src/ui/Popover/: Popover.tsx, PopoverGroup.tsx, ListRow.tsx, Popover.css, index.ts
- src/ui/Menu/: Menu.tsx, MenuItemRadio.tsx, Menu.css, index.ts
- src/ui/SplitButton/: SplitButton.tsx, SplitButton.css, index.ts
- src/ui/Dialog/: Dialog.tsx, DialogFooter.tsx, FieldGroup.tsx, Dialog.css, index.ts
- Tests: hooks/useListKeys.test.tsx, Popover/Popover.test.tsx, Menu/Menu.test.tsx, SplitButton/SplitButton.test.tsx (incl. CSS one-ring contract), Dialog/Dialog.test.tsx. 45 new tests.

Props as built
- Popover {label, anchorRef, onClose(refocus), variant?: source|mode, align?: start|end, testId?}. role=dialog, non-modal.
- PopoverGroup {label, divided?}. ListRow {label, current?, unavailable?, dimmed?, highlight?, title?, onSelect, actions?, testId?}; select button carries data-list-item and aria-current; actions in .list-row-actions.
- Menu {label, heading?, anchorRef, align?, onClose(refocus), testId?} with MenuItemRadio {name, description?, icon?, checked, onSelect, testId?}.
- SplitButton {groupLabel, tone: accent|violet|danger, dataMode?, dataState?, main:{label, icon?, ariaLabel?, title?, disabled?, busy?, onPress, testId?}, chevron:{ariaLabel, title?, disabled?, locked?, expanded, popup?, onPress, onKeyDown?, testId?}, chevronRef?, children}.
- Dialog {title, onClose, dismissable?, returnFocusTo, initialFocus?, onSubmit?, testId?}; DialogFooter {start?, children}; FieldGroup {legend, children}.

Checks
- npm run check: exit 0. 47 files, 450 tests; clippy, lint, tsc, prettier all clean.
- Existing SourceMenu, SourceDialog, SourceButton, CaptureControl tests pass (115) after the import change.
- No e2e (only import paths changed in feature code).

Deviations and notes
1. Popover closes on focusout, not on the Tab keydown. Closing on keydown unmounts the popover before the browser moves focus, and focus then restarts at the top of the document. Escape still closes on keydown.
2. ListRow has no ArrowLeft/Right and no F2/Delete. DESIGN 5.10 marks Left/Right as Proposed (ordinary Tab), and F2/Delete belong to the feature wiring (T9/T10) on the row's keydown.
3. useListKeys clamps at the ends. DESIGN gives no wrap rule for the popover, so I chose no-wrap. Please confirm.
4. SplitButton uses no custom properties. The token guard reads every var(--x) as a token and fails on component-local ones, so each tone is written as explicit rules.
5. Tokens without a name: Dialog backdrop padding-top 90px and dialog side padding 18px are literals (DESIGN 3.8). Action buttons in ListRow are sized --control-height-small (24px), not the 20px of today's .source-actions. Visible change on wiring; the designer should confirm.
6. Disabled opacity uses --opacity-unavailable (0.6, F9 value from T1), not today's 0.45.
7. Dialog footer and row action buttons are the caller's buttons. I added no button styling; those come from Button (T3) at wiring (T11).
8. I ran `prettier --write src/ui` once early on, which also reformats other tasks' files in src/ui (formatting only). It was not limited to my folders. Mentioning it so nobody is surprised by a diff.
9. Old legacy markup and CSS (source.css, capture.css, sourceDialog.css) are untouched; the feature still uses them until T9/T10.
