# 009 Design system
Status: accepted (human, 2026-11-17)

As the team building Spectrum Studio, we want a written design system and a library of reusable,
logic-free UI components, so that the growing app stays visually consistent and new screens are
built from shared parts instead of copy-pasted markup and CSS.

## Acceptance criteria
- [ ] `/DESIGN.md` exists at the repo root and follows design-file best practice: principles, design
      tokens (colour incl. semantic roles such as capture teal/purple/red, typography, spacing,
      radius, elevation, motion, z-index), layout/grid, component catalogue (purpose, anatomy,
      variants, states, do/don't, a11y), interaction & keyboard patterns, content/copy rules,
      accessibility requirements (contrast, focus, reduced motion), and how to add/change a token
      or component. It is linked from `docs/README.md`.
- [ ] Every token in DESIGN.md exists in code as a single source of truth (CSS custom properties);
      no hard-coded colour/spacing values remain in component CSS except where DESIGN.md allows it.
- [ ] General-purpose visual components live in `src/ui/` (e.g. Button, IconButton, Menu, Dialog,
      Field/NumberInput, Badge, Banner, Panel…; final list from the staff engineer's plan). They are
      presentational: props in, callbacks out; no IPC, app state, session or device knowledge.
- [ ] Feature code (`src/components/…`) uses `src/ui/` components instead of its own duplicates;
      duplicated markup/CSS for the same element is removed.
- [ ] Each `src/ui/` component has unit tests (render, variants, states, keyboard/a11y where relevant).
- [ ] An architecture decision (ADR) records the ui/feature boundary and the token approach; a lint
      or test guard prevents `src/ui/` from importing IPC/state/bindings modules.
- [ ] The app looks the same as before except for the small fixes the designer listed in DESIGN.md
      and the human approved; QA verifies visually with before/after screenshots of every screen and
      state (source menu/dialog, capture modes, panels, banners, status bar, narrow window).
- [ ] `npm run check` and `npm run e2e` green; docs (`docs/architecture.md`, `docs/guidelines.md`)
      updated.

## Out of scope
- New features, new screens, or a visual redesign / theme change (light theme, etc.).
- Plot/waterfall canvas rendering internals (only their surrounding chrome uses tokens).
- Adding a third-party component or CSS framework (keep dependencies minimal; any proposal needs an ADR).
- Storybook or similar tooling unless the staff engineer justifies it in an ADR and the human agrees.

## Notes / constraints
- Pure refactor of behaviour: no change to what the UI shows about backend state; hardware honesty
  and unit labelling (dBFS vs dBm) rules from CLAUDE.md unchanged.
- Capture colour semantics (teal/purple/red) and minimal copy from work 006 must be preserved.
- Gates: human reviews DESIGN.md + the list of proposed small fixes (with before/after visuals) before
  engineering; human final acceptance with QA screenshots.
