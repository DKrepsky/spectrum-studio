# `src/ui/`: presentational components

Props in, callbacks out. No app state, IPC, bindings, plot or feature components (ADR 0015).
One folder per component: `<Name>.tsx`, `<Name>.css`, `<Name>.test.tsx`, `index.ts`, and `<Name>.stories.tsx` (one story per state; catalogue with `npm run storybook`, guarded by `stories.test.tsx`, which also runs axe on every story, ADR 0016).
Catalogue and rules: `/DESIGN.md` section 10.2; decision: `docs/adr/0015-ui-feature-boundary-and-design-tokens.md`.

API conventions (staff review): `unavailable` = focusable but inert, reason in visible text (Button, IconButton, ListRow, Select/Checkbox use native `disabled` only where unfocusable is right); `busy` only on Button; `onClose(refocus: boolean)` on Popover/Menu, `onClose()` on Dialog (focus via `returnFocusTo`); simple elements forward `data-testid`, composites take `testId` (Dialog also `titleTestId`, Field `errorTestId` for its error message).

Feature code imports a folder's index only (`../ui/Popover`, `../ui/Field`), never an internal file or `ui/hooks`: ESLint (`no-restricted-imports` in `eslint.config.js`) and `boundary.test.ts` both check it. Stylesheets: each `Name.css` is imported by a component beside it (`cssImport.test.ts`).
