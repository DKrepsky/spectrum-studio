# ADR 0015 — `src/ui/` presentational layer, feature containers and design tokens

Status: accepted (2026-11-16, work 009; proposed by the staff engineer, scope set by the human)

## Context

The frontend grew feature by feature. Buttons, fields, badges, popovers and the dialog are styled by
global element selectors in `app.css` and by per-feature CSS; the same element exists in two or
three variants; colours and sizes are literals; the plot canvas keeps its own copy of the palette.
Work 009 introduces a written design system (`/DESIGN.md`) and asks for reusable visual components
that know nothing about the application. Two decisions need a record: where the line between
"visual" and "application" code runs, and how design tokens reach CSS, React and the canvas.

## Decision

### 1. Two layers

- **`src/ui/`: presentational components and DOM behaviour hooks.** Props in, callbacks out. A
  `src/ui/` module may import only React, `react-dom`, other `src/ui/` modules, `src/format/` (pure
  formatters and parsers) and CSS. It must not import `src/ipc`, `src/state`, `src/bindings`
  (not even types), `src/plot`, `src/components`, `@tauri-apps/*` or `zustand`. Prop types are
  defined in `src/ui/` in visual vocabulary (`tone`, `variant`, `status`), never in domain types;
  the feature container maps domain state to them.
- **`src/components/`: feature containers.** They read the store, call IPC through `src/state`,
  map domain values to `src/ui/` props and compose them. They contain no styling decisions beyond
  layout of their own area; they use `src/ui/` components for every button, field, badge, banner,
  popover, dialog and table.
- Dependency direction is one way: `components -> ui -> (react, format)`. `src/ui/` never knows a
  device, a session state or a unit.

### 2. Guards

- ESLint `no-restricted-imports` override for `src/ui/**` (relative paths into the forbidden
  folders, `@tauri-apps/*`, `zustand`), including test files.
- A Vitest test (`src/ui/boundary.test.ts`) scans every file under `src/ui/` and fails on the same
  imports. It also forbids `toFixed` and `toLocaleString` there (formatting goes through
  `src/format/`, DESIGN.md 7.5) and catches what a lint override could miss (dynamic imports,
  `vi.mock` of forbidden modules).

### 3. File layout

One folder per component: `src/ui/<Name>/<Name>.tsx`, `<Name>.css`, `<Name>.test.tsx`, `index.ts`.
Components of one family that share CSS share a folder (`Field/` holds Field, TextField,
NumberField, FrequencyField, Select, Checkbox). No barrel file: consumers import
`../ui/Button`. Shared DOM hooks live in `src/ui/hooks/`. Component CSS is co-located and imported
by the component, uses `ui-` prefixed class names and only tokens. Feature CSS stays in
`src/styles/` and positions things; it uses tokens too.

### 4. Tokens

- **One source file: `src/styles/tokens.css`**, equal to DESIGN.md Appendix A (a test compares them
  after whitespace normalisation, so the document and the file cannot drift). It is imported first
  in `main.tsx`. It also declares the cascade layer order.
- **CSS** reads tokens with `var(--token)`. **React** reads nothing: components emit class names;
  inline styles only for values computed from plot geometry.
- **Canvas** reads tokens at runtime: `src/plot/theme.ts` exposes `getPlotTheme()`, which calls
  `getComputedStyle(document.documentElement).getPropertyValue(name)` once, caches the resolved
  object and throws on a missing token (no fallback). WebKit returns custom properties with
  `var()` substituted, so a semantic token that points at a primitive resolves to a plain colour.
  `PLOT_INSETS` and the colour-map LUT stay in TypeScript (DESIGN.md Appendix B). The reader takes
  an injectable `read(name)` function; tests pass a resolver backed by the parsed `tokens.css`
  (jsdom does not resolve `var()` chains), so the canvas never needs a copy of a colour.
- **Rejected: generating a TypeScript token module** (from CSS or from Appendix A). It adds a build
  step and a second artefact to keep in sync, and the canvas would still need the CSS for the DOM;
  reading the live CSS has no copy to drift. Cost: a runtime read at first draw (about 20
  `getPropertyValue` calls, once).
- **Rejected: CSS-in-JS or CSS modules.** New tooling and dependencies for no gain; the app has no
  naming collisions that a prefix does not solve.
- **Rejected: Storybook.** The story excludes it unless justified; the prototype and QA
  screenshots are the visual reference. Revisit when `src/ui/` has more than one consumer app.

### 5. Cascade during migration

Components are built before their consumers are migrated, so the old global control rules in
`app.css` (`button`, `button:hover:not(:disabled)`, `input`, `select`, ...) still exist while new
components appear. They are wrapped in `@layer legacy-controls`; `tokens.css` declares
`@layer legacy-controls;` first. `src/ui/` CSS and feature CSS are unlayered, so they win over the
legacy rules regardless of specificity, and the proposed fixes (F9 opacity, F2 sizes) take effect
the moment a component is used. The layer and its rules are deleted when the last raw control is
migrated. The layer is supported by every WebKitGTK that Tauri 2 requires (Safari 15.4 equivalent).

**Status (work 009, T11):** the legacy-controls layer was removed in T11 (009). No `legacy-controls`
rule or layer remains in `src`; the paragraphs above describe the migration as it was.

### 6. Tests

Each `src/ui/` component has Vitest tests (render, variants, states, keyboard and ARIA). Token
tests (`src/styles/tokens.test.ts`) check: every `var(--x)` in `src/**/*.{css,ts,tsx}` is defined;
no colour, radius, shadow or z-index literal in non-token CSS outside DESIGN.md 2.17; contrast
pairs of DESIGN.md 9.3 and 9.4 computed from the token values; every `PLOT_THEME` key maps to an
existing token; Appendix A equals `tokens.css`. Visual correctness is verified by QA with before
and after screenshots (DESIGN.md 10.4), not by pixel-diff tooling.

## Consequences

- New screens are composed from `src/ui/`; a visual change is made in one place.
- Feature code cannot import visual internals and `src/ui/` cannot grow application knowledge
  without failing lint and tests.
- Changing a token is one edit plus the Appendix A edit; the test fails if only one was made.
- During migration two systems coexist, bounded by the `legacy-controls` layer; the final task
  removes it and the token aliases stay for one release (DESIGN.md 2.19).
- `ui-` class names are not a public contract for e2e tests; e2e selects by `data-testid`, role or
  label. `src/ui/` components forward `data-testid` and the other native attributes.
