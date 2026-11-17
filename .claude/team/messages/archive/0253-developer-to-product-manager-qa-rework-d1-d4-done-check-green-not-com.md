---
id: 0253
from: developer
to: product-manager
type: handoff
subject: QA rework D1-D4 done, check green, not committed
work: 010-storybook
reply-to: 
date: 2026-11-17T01:47:43-03:00
---

QA rework for 010-storybook (D1-D4). `npm run check` green (exit 0; 656 vitest tests, lint, types, prettier). Not committed.

Defects:
- D3 (Dialog stories, story only): the `Source` / `Connection` FieldGroup wrappers were not in the app. Removed them from every Dialog story, so the Name field sits directly under the title as in SourceDialog. FieldGroup itself is unchanged (still used by Dialog.test.tsx; no app usage, noted for later).
- D2 (Menu/Popover stories): two root causes, both in the Storybook layer, not the component.
  1. Clipping: .storybook/preview.css made html, body and #root all scroll containers. Body was only as tall as its in-flow content (56px), so the absolutely positioned popover overflowed it, and focusing the checked item scrolled body by 88px, pushing the trigger and top of the menu out of the frame. Fixed: html is now the only scroll container; body and #root are overflow visible. Popover stories (O1) were clipped by the same cause and are fixed too.
  2. Check over label: MenuItemRadio stories had no icon. Its .menu-item-icon:empty rule is display:none, so the grid lost its first (18px) track and the name fell into the glyph column. The app always passes an icon (CaptureModeMenu), so the app is not affected. Stories now pass an 18px glyph to each item like the app.
  Component (Menu.tsx, MenuItemRadio.tsx, Menu.css) unchanged. Candidate for PM: an icon-less item breaks the grid (DESIGN.md 4.11 says the first column is an 18px icon). Not fixed; app does not hit it.
  The app's capture menu could not be opened in the Vite-only dev server (no source connected, chevron unavailable), so the comparison with the app is by code (same icon, same Menu markup) plus the Vite run showing the menu closed.
- D1 (Badge long text): the chip does not truncate or wrap, and DESIGN.md 4.7 gives no truncation rule for chips (5.9 lists no chip). Per the rule, Badge.css and Badge.tsx are unchanged. The story keeps the real overflow and its doc comment says so. Issue candidate for PM: decide chip long-text behaviour (5.9 rule 2 would say ellipsis with the full text in title). Note: the app's source row already clips the chip with overflow hidden in a fixed 64px column (source.css .source-row-badge).
- D4: DESIGN.md 4.12 saving-state sentence now says the spinner is shown and the label is kept transparent (width unchanged, name kept), matching 4.1. No visual change.

Files changed:
- .storybook/preview.css (shell: html scrolls, body/#root do not)
- src/ui/Menu/Menu.stories.tsx (GLYPH icon on every item)
- src/ui/Dialog/Dialog.stories.tsx (FieldGroup removed)
- src/ui/Badge/Badge.stories.tsx (doc comment on ChipLongText only)
- DESIGN.md (4.12 saving sentence)

Screenshots (overwritten under the same names, 720x480, in .claude/team/work/010-storybook/screenshots/):
- sb-menu-default-720-stub.png (fixed: whole menu visible, check in own column)
- sb-menu-long-name-720-stub.png, sb-menu-no-description-720-stub.png (new)
- sb-popover-default-720-stub.png (O1 fixed)
- sb-dialog-idle-720-stub.png, sb-dialog-saving-720-stub.png, sb-dialog-testing-720-stub.png (Name field under title)
- sb-badge-chip-long-text-720-stub.png (still overflows, as the component does; sb-badge-chip-long-text-720-zoom.png is the earlier zoom, same behaviour)
- sb-tokens-top-720-stub.png, sb-tokens-end-720-stub.png (page still scrolls to 3926 of 4406)
Raw captures from my scratch run are not in the work folder.

Open for PM: D1 long chip text rule; icon-less MenuItemRadio grid (candidate); FieldGroup unused by the app.
