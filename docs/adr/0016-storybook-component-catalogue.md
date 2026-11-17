# ADR 0016 — Storybook as the component catalogue

Status: accepted (2026-11-17, work 010; proposed by the staff engineer, choice of Storybook made by
the human; issue #36)

## Context

The design system (`DESIGN.md`, `src/ui/`, `src/styles/tokens.css`, ADR 0015) can be seen only inside
the running app, where many states (busy, unavailable, error, long text, open overlays) are hard to
reach. Contributors, human or AI, need to browse each component and its states in isolation, and the
catalogue must not drift from the components.

## Decision

1. Add **Storybook 10** as a dev-only tool: `storybook` and `@storybook/react-vite` (devDependencies,
   `^10.6.7`; peers satisfied by Vite 8, React 19, TypeScript 6). Addons: only
   `@storybook/addon-a11y` (devDependency, `^10.6.7`, peer `storybook` `^10.6.7`). It adds the
   Accessibility panel (axe) to each story in `npm run storybook`, and it depends on `axe-core`
   (`^4.2.0`, the range the addon declares). `axe-core` is also a direct devDependency
   (`^4.14.1`, the version in the tree) because `src/ui/stories.test.tsx` imports it to run axe on
   every story inside `npm test`; that is the same engine, not a second copy. Not added: docs
   (MDX and autodocs), `addon-vitest` (needs a browser runner and Playwright browsers, which we
   refuse), `eslint-plugin-storybook`. Its dependencies are the cost: a few hundred dev packages,
   nothing in the app bundle or `tauri build`.
2. Stories live beside components (`src/ui/<Name>/<Name>.stories.tsx`, CSF3, typed against the real
   props). The tokens page is a story that reads `tokens.css` (`?raw`) so it cannot drift.
3. Stories are code under `src/ui/`, so ADR 0015's boundary applies to them unchanged.
4. Nothing imports Storybook outside `*.stories.tsx`, tests and `.storybook/`; a test enforces it, so
   the Vite app build and `tauri build` contain no Storybook code.
5. `npm run check` fails when a `src/ui` component folder lacks a stories file, any story throws on
   render, or any story has an axe violation, using Storybook's portable stories (`composeStories`)
   and axe-core inside the existing jsdom Vitest run. axe runs with the addon's rules: `region` off.
   Its `color-contrast` check is not judged in jsdom (no layout); the token tests cover contrast. A
   story that needs an exception sets `parameters.a11y.config.rules` and says why. The static build
   (`npm run build-storybook`) is run on demand, not part of `check`; the browser Accessibility panel
   covers what jsdom cannot (contrast, layout).
   Violations found and fixed when the check was added (work 010): a `form` with `role="dialog"`
   (aria-allowed-role) became a `div` with the form inside; the story triggers became the `Button`
   component (a plain button had a UA background with failing contrast).
   Accepted exception: `label-content-name-mismatch` is off in the Popover stories that show a
   transport badge, because a row's name is its name and status (DESIGN.md 9.12) and the badge is
   supplementary text. Open for the PM; see the Popover stories.
6. Telemetry and crash reports are disabled in `.storybook/main.ts` (local-first product).

## Consequences

- Several hundred transitive dev packages; lockfile grows; install is slower. No effect on the
  shipped app, Cargo or the `.deb`/AppImage.
- Each new `src/ui` component must ship with stories (enforced); DESIGN.md 10.2 records the rule.
- jsdom does not lay out, so the check proves stories render, not that they look right; visual match
  is checked in review (and visual-regression snapshots stay out of scope, issue #36).
- Storybook majors move fast; upgrades are a separate chore, and the Vite 8/TS 6/ESLint 10 stack is
  newer than Storybook's documented matrix, so an upgrade may need waiting for a fix.

## Alternatives considered

- **Ladle**: much smaller, Vite-native, CSF-compatible. Rejected by the human in favour of the
  ecosystem and tooling of Storybook.
- **In-house gallery page** (a route or a separate Vite entry rendering a list of components): no
  dependency, but we would maintain the catalogue shell, args controls and isolation ourselves, and it
  risks ending up in the app bundle.
- **`@storybook/addon-vitest` for the render check**: real browser tests, but needs
  `@vitest/browser` and Playwright; rejected for dependency weight and offline setup.
