---
id: 0255
from: developer
to: product-manager
type: handoff
subject: 010 rework 2 done: badge ellipsis, icon-less menu, a11y addon (cc staff-engineer)
work: 010-storybook
reply-to: 
date: 2026-11-17T02:18:42-03:00
---

Rework 2 of 010 (three follow-ups before commit). Nothing committed. Work folder: .claude/team/work/010-storybook/ (screenshots in screenshots/).

## 1. Badge long text (src/ui/Badge)
- Chip/tag text is one line; the label (`span.ui-badge-label`, new) ends in an ellipsis inside the pill (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`). Tokens only.
- Native `title`: set to the full text only when the text is cut (measured with scrollWidth/clientWidth, re-measured with ResizeObserver). A caller's `title` wins. Accessible name is always the full text.
- DESIGN.md 4.7: "Long text" rule added. DESIGN.md 4.7 wording of "Sizes" unchanged.
- Tests: Badge.test.tsx "long text" block (ellipsis CSS, title when cut, none when it fits, caller title wins).
- Stories: ChipLongText (140px, ellipsis) and new ChipInColumn (64px column, "Built-in" unchanged).
- App usages checked: source rows (USB and Built-in, 64px column), the HOLD/LIVE plot tag. Short labels unchanged. Screenshots: badge-chip-long-text-140.png, badge-chip-in-column.png, badge-chip-usb-unchanged.png; app: e2e shots menu-open-1180-visual.png, hover-actions-replace-badge-1180-long-name.png (in scratchpad, see below).

## 2. Menu item without icon (src/ui/Menu)
- Removed `.menu-item-icon:empty { display: none }`; an empty 18px track stays. Comment in Menu.css.
- Tests: Menu.test.tsx (icon cell present and empty; no display:none rule for menu-item-icon, with a planted self-check).
- Story: Menu "NoIcon". DESIGN.md 4.11 sentence added.
- Screenshots: menu-no-icon-720.png vs menu-default-with-icons-720.png (names, descriptions, check marks line up).
- The QA D2 clipping on the Menu story does not reproduce in this capture (the menu is fully in frame at 720px); the Popover top-clip (O1) was not re-examined beyond the a11y run.

## 3. Accessibility add-on
- `@storybook/addon-a11y@^10.6.7` added (devDependency), registered in .storybook/main.ts (Accessibility panel per story).
- `axe-core@^4.14.1` added as a direct devDependency (already in the tree through the addon, same version): src/ui/stories.test.tsx runs axe on every story in `npm test`, so `npm run check` fails on a new violation. `region` off as in the addon; a story narrows rules with `parameters.a11y.config.rules`. Self-check test with a planted image-alt.
- Real-browser run: headless Chrome against the static build, axe on all 109 story entries, honouring the per-story parameters: 0 violations (results: scratchpad a11y/axe-browser-results.json).

Findings and resolution:
a. Dialog: `<form role="dialog">` fails aria-allowed-role (minor). Fixed: the dialog is a div with role dialog; the form inside holds the body and footer (display: contents, same layout). Dialog.tsx/.css, unit tests pass, e2e add-dialog screenshots look unchanged. Affects all Dialog stories.
b. color-contrast (serious) on the plain `<button>` triggers in the Dialog, Menu and Popover story wrappers (UA default background, 4.15:1). Story-only: replaced with the Button component. The app's own triggers are Button/SplitButton, so no app change.
c. label-content-name-mismatch (serious) on Popover rows: the row name is "Name, Status" (DESIGN.md 9.12), while the transport badge (USB/Built-in) and port/device id are visible text outside the name. Story fixes: LongName visible text now matches its name (it had extra words); RowUnavailable has a space between its two spans (no-space markup made axe read "Bench SA430Not detected").
   DECISION FOR PM (not fixed in the app): the rule is kept off in the Popover stories that show a badge (Default, RowActions, LongName) via `BADGE_OUTSIDE_NAME` in Popover.stories.tsx, with the reason in a comment. If the transport belongs in the accessible name, ListRow's `label` should change instead (app behaviour and e2e names change), and the exemption goes.
d. jsdom cannot judge color-contrast (no layout): reported as incomplete, not violation; the token tests (DESIGN.md 9.3, 9.4) cover it. The browser run covers it.

Docs: ADR 0016 (decision 1 and 5, dependencies and the three findings), docs/testing.md (Stories row and "Accessibility of the stories"), docs/development.md (build-storybook row), src/ui/README.md, DESIGN.md 10.3 (axe guard added to the stories line).

## Checks (all run on the final tree)
- `npm run check`: exit 0. Vitest 53 files / 666 tests passed; cargo fmt, clippy, cargo test all ok (Rust untouched).
- `npm run build-storybook`: exit 0 (chunk-size warning only).
- `npm run build`: exit 0; `grep -ril storybook dist` = 0 matches.
- `npm audit --omit=dev`: 0 vulnerabilities. `npm audit` (dev) reports 24 moderate, all in the dev tree: glob via @joshwooding/vite-plugin-react-docgen-typescript (pulled by @storybook/react-vite; the audit's fix is a downgrade to Storybook 8.5, not acceptable) and the wdio chain (pre-existing). Not fixed; the human should decide.
- e2e: `npx tauri build --debug --no-bundle` ok. `npm run e2e:run` with WebKitWebDriver extracted to scratchpad: visual.e2e.ts 46 passing, 1 failing on the first run ("source menu: Undo toast and keyboard focus at 1440px", Forget button not interactable). It passes alone and in a second full run (visual + source-row: 47 + 11 passing). Looks intermittent, not reproduced; not investigated further. The full `npm run e2e` was not run.

## Screenshots (.claude/team/work/010-storybook/screenshots/, looked at)
- badge-chip-long-text-140.png: ellipsis inside the pill.
- badge-chip-in-column.png, badge-chip-usb-unchanged.png: short labels unchanged.
- menu-no-icon-720.png, menu-default-with-icons-720.png.
- a11y-panel-popover-default-1280.png: Accessibility panel, 0 violations, 18 passes.
- a11y-panel-menu-no-icon-1280.png.

## Open for PM
- Decision on the row accessible name (item 3c).
- Dev-tree npm audit (3 above).
- DESIGN.md edits: 4.7 (long text), 4.11 (icon column), 10.3 (axe). Human owns the content.
- Not done: the Vite-only story-vs-app comparison of Menu/Dialog (QA 3); the QA D4 busy-Save wording is untouched.
