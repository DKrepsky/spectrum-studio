# Plan 010: Storybook for `src/ui` (issue #36)

## Decision summary

Real Storybook, dev-only, react-vite framework, **no addons** beyond what ships in core. Stories sit
beside their component. `npm run check` (through Vitest) fails when a `src/ui` component folder has
no stories file or when any story throws on render. Storybook never enters the app graph: nothing
under `src/` outside `*.stories.tsx` and the story tests imports it, and a test enforces that.
ADR: `docs/adr/0016-storybook-component-catalogue.md`. One developer task (T1); see `tasks/T1.md`.

## Versions (verified on npm, 2026-11-17)

| Package | Version | Peer check |
| --- | --- | --- |
| `storybook` | ^10.6.7 | core CLI; includes controls, actions, viewport, backgrounds, `storybook/test` |
| `@storybook/react-vite` | ^10.6.7 | peers: vite `^5 .. ^8` (repo has 8.3.x), react `^16.8 .. ^19` (repo 19.3), typescript >= 4.9 (repo 6.0) |

Both are `devDependencies`. The developer must run `npm install` and confirm no peer warnings and
that `npm run storybook` starts under Vite 8 / TS 6 / ESLint 10 / Vitest 5 (all currently newer than
anything the Storybook docs mention; if a hard incompatibility appears, stop and report, do not pin
the app's tooling down).

### Addons: none, on purpose

- `@storybook/addon-docs`: not needed. It brings MDX and autodocs and a large extra tree. The tokens
  page is a plain TSX story instead (below). Components are documented in DESIGN.md section 4.
- `@storybook/addon-a11y`: useful, but it is a second dependency decision and axe findings would need
  triage against DESIGN.md 9. Proposed as a follow-up issue, not in this change.
- `@storybook/addon-vitest`: needs `@vitest/browser` + Playwright (browsers download). Rejected; the
  portable-stories route below runs in the existing jsdom Vitest with no new dependency.
- `eslint-plugin-storybook`: rejected, third dependency for rules that `strictTypeChecked` already
  mostly covers.

## Where things live

```
.storybook/main.ts          stories glob, framework, viteFinal
.storybook/preview.tsx      imports tokens.css, app.css, preview.css; dark backgrounds; layout
.storybook/preview.css      storybook-only override (see "Global styles")
src/ui/<Name>/<Name>.stories.tsx   one per component folder (CSF3, typed with `Meta`/`StoryObj`)
src/styles/Tokens.stories.tsx      tokens page, title "Design system/Tokens"
src/ui/stories.test.tsx            guard + render test (portable stories)
src/ui/storybookBoundary.test.ts   (or a describe inside boundary.test.ts) keeps storybook out of the app
```

Story titles: `UI/<Name>` (e.g. `UI/Button`), tokens `Design system/Tokens`. Stories import the
component from `./<Name>` (or `./index`) and siblings by folder index, like feature code would.
`hooks/` has no stories (not a component; it has no `index.ts`). Components that are building blocks
inside another folder (e.g. `Popover/ListRow`) are covered by the owning folder's stories file; the
guard works on folders that have an `index.ts`.

`src/ui/**/*.stories.tsx` stays inside the ADR 0015 boundary: the existing ESLint pattern and
`boundary.test.ts` apply to stories too (no state, IPC, bindings, plot, components, Tauri, zustand;
no `toFixed`/`toLocaleString`). That is a feature: story data cannot reach for app types. Stories
build their own sample values (long names, error text) as literals. `storybook`/`@storybook/*` are
not in the forbidden list and may be imported in stories only (the guard below limits where).

## Global styles, tokens, fonts

- `preview.tsx` imports `../src/styles/tokens.css` then `../src/styles/app.css`, same order as
  `src/main.tsx`, so tokens and global element rules are the app's, not copies.
- Fonts: `--font-family-ui` is a system stack (Inter, Cantarell, Ubuntu, system-ui); there are no
  webfont files to load. Nothing to configure; stories render in whatever the host resolves, same as
  the app.
- Dark theme: `app.css` sets `color-scheme: dark` and the app surface colour on `html, body`. Set
  `parameters.backgrounds` to a single `app` entry (`var(--color-surface-app)` resolved value is not
  possible in config; use `disable: true` for the backgrounds toolbar and rely on the body style) and
  add a second named `panel` option only if a component sits on `--color-surface-panel` in the app.
  Simplest: `backgrounds: { disable: true }` and a decorator wrapper
  `<div style={{ padding: 'var(--space-6)' }}>` (layout `fullscreen`, wrapper pads).
- **Known deviation** (`preview.css`, loaded after `app.css`): `app.css` sets
  `html, body, #root { height: 100%; overflow: hidden; user-select: none }` for the app shell. In
  Storybook that blocks scrolling of long pages (tokens page). `preview.css` resets
  `html, body { height: auto; overflow: auto }` and `user-select: auto`. Document this in a comment.
  Nothing else may be overridden; if a story only looks right with an extra rule, the story is wrong.
- Overlay components (Dialog, Popover, Menu) portal or position themselves: stories open them
  already-open (`open`/`anchor` props as the component defines) with a decorator that provides an
  anchor element. The developer reads each component to see what it needs.

## Tokens page

`src/styles/Tokens.stories.tsx` reads `./tokens.css?raw` (Vite `?raw`, typed by `vite/client`),
parses with `parseTokens` from `src/test/tokens.ts` (or a tiny local parser if that import feels
wrong; it is pure), and renders sections: colour (palette primitives, semantic colour; swatch +
name + resolved value, grouped by `--palette-`, `--color-`), type scale (`--font-size-*`,
`--font-weight-*`, `--line-height-*`, sample text at each size), spacing (`--space-*` as bars),
radius (`--radius-*`). Derived from the file at build time, so it cannot drift. Excluded: the
migration alias block and layout tokens (toolbar sizes); render them only if cheap. Uses its own
`style` attributes with `var(--token)` references; no new CSS file under `src/` (cssImport guard
forbids stray stylesheets; inline styles are fine). It also has a story (render test covers it).

## Fail `npm run check` on missing or broken stories

`npm run check:web` already ends with `npm test` (Vitest, `src/**/*.test.{ts,tsx}`), so the guards
are plain Vitest tests; no script change to `check`.

`src/ui/stories.test.tsx`:

1. **Coverage guard**: for each directory under `src/ui/` containing `index.ts` (all but `hooks`),
   `<Folder>/<Folder>.stories.tsx` must exist. Failure message names the folder.
2. **Glob guard**: `import.meta.glob('/src/**/*.stories.tsx', { eager: true })`; every module has a
   default export with `title` and at least one story export. Guard 1 and this together mean a new
   component cannot ship unlisted.
3. **Render test**: `setProjectAnnotations` with the module imported from `.storybook/preview.tsx`
   (so decorators and parameters match Storybook), then for every module `composeStories(module)` and
   for every story `render(<Story />)` inside RTL, then run the story's `play` if any
   (`await Story.run()` is the portable-stories API that applies decorators, loaders and play; use
   it with the RTL `render` as `canvasElement` host, or use `Story.run({ canvasElement })` per the
   Storybook 10 docs; the developer picks the form that works and asserts something real). The test
   fails on a thrown render, a React error logged through `console.error` (setup should fail the test
   on `console.error` for this file only, via `vi.spyOn(console, 'error')` and an `afterEach` assert),
   and an empty container (`container` has no child element).
4. Each story renders with the same global CSS as the app only in the browser; jsdom does not lay
   out. That is acceptable: the test catches crashes and missing exports. Visual match is checked in
   review by screenshots (below).

`preview.tsx` imports CSS: Vitest handles CSS imports (jsdom, `css: false` default processes to
empty). If importing the preview into tests causes friction, split non-CSS annotations into
`.storybook/annotations.ts` and import that from `preview.tsx` and from the test. Developer decision.

`build-storybook` is not part of `npm run check` (it takes tens of seconds and rebuilds Vite). It is
run by the developer and QA before handoff and documented. Optional follow-up: add it to CI when CI
exists; the repo has no `.github/workflows`.

## Keeping Storybook out of app, tsc, eslint, prettier

- **App build**: the Vite entry is `index.html -> src/main.tsx`. Nothing there imports stories or
  Storybook. Guard test `storybookBoundary` (in `stories.test.tsx` or `boundary.test.ts`): every file
  under `src/` that is not `*.stories.tsx`, `*.test.ts(x)`, or `src/test/` must not import
  `storybook`, `@storybook/*`, or a `.stories` path; verify the regex with a self-check like the
  existing tests. Plus a manual check in T1 acceptance: `npm run build`, `grep -ril storybook dist`
  returns nothing. `tauri build` consumes the same `dist` (`beforeBuildCommand` is `npm run build`;
  verify in `src-tauri/tauri.conf.json`).
- **Dev server port**: `vite.config.ts` pins `server.port: 1420, strictPort: true` for Tauri.
  `@storybook/react-vite` merges the project's Vite config; set `viteFinal` in `main.ts` to drop
  `server` (or set `strictPort: false`) so `npm run storybook` (port 6006) never clashes with
  `tauri dev`. Also drop the Vitest `test` block is unnecessary (ignored by Vite). Do not edit
  `vite.config.ts` for Storybook.
- **tsc**: `tsconfig.json` `include` becomes `["src", ".storybook", "vite.config.ts"]` so stories
  (already under `src`) and the config are typechecked. `.storybook/*.ts(x)` need `jsx` types;
  fine. `types` array stays. Stories are typed with `Meta<typeof X>`/`StoryObj`.
- **eslint**: add `.storybook` handling: stories and `.storybook/**` are linted with the same strict
  config (they are TS in tsconfig, so `projectService` works). Add `storybook-static` to `ignores`.
  If `.storybook/main.ts` trips `no-restricted-imports` or type-aware rules for config files, give it
  the `*.config`-style block (`disableTypeChecked`, node globals) via
  `files: ['.storybook/main.ts']`. A `Meta` with `args` often triggers
  `@typescript-eslint/no-unsafe-*`; fix the types, do not disable rules wholesale.
- **prettier**: `.prettierignore` gets `storybook-static`. Stories and `.storybook` are formatted by
  Prettier like everything else.
- **gitignore**: add `/storybook-static` (and `*.log` already covers `storybook.log`; add
  `debug-storybook.log` only if it appears).
- **vitest include** stays `src/**/*.test.{ts,tsx}`; stories are not picked up as tests directly.

## Scripts

```
"storybook": "storybook dev -p 6006 --no-open",   // --no-open is the developer's call; issue says
                                                  // "opens", so omit --no-open: default opens browser
"build-storybook": "storybook build"              // output storybook-static/
```
Use `storybook dev -p 6006` (opens a browser by default; add `--ci` is for CI only). Also
`STORYBOOK_DISABLE_TELEMETRY`: add `"disableTelemetry": true` under `core` in `main.ts` (local-first
app, no phoning home; `core.disableTelemetry`). Also set `core.enableCrashReports: false`.

## Docs touched

- `src/ui/README.md`: one line on `<Name>.stories.tsx` per folder and the guard; commands.
- `DESIGN.md` 10.2: add rule 7 (a component has stories for each state it documents) and 10.3 guards
  list (stories test). Keep wording short; the human owns DESIGN.md content, so developer adds only
  these two lines and flags them in the handoff.
- `docs/development.md`: `npm run storybook` / `build-storybook`; `docs/testing.md` mention the
  stories test.
- `CLAUDE.md` commands table row: proposed to PM, not edited by developer.

## Stories content (per component)

One stories file per folder with an `index.ts`: Badge, Banner, Button, Dialog, Field (also covers
Checkbox, Select, TextField if they live in `Field/`), IconButton, InlineMessage, LiveRegion, Menu,
Popover, Section, Spinner, SplitButton, StatusDot, StatusStrip, Table. Developer lists the real
folders with `ls src/ui`. States come from DESIGN.md section 4 for each component and the
component's own props: default, each variant, sizes, `unavailable`, `busy`, error, disabled/focus
(use `play` with a `focus()` call or a story `args` prop where the component exposes one), long
text (overflow/ellipsis as DESIGN.md specifies), narrow width via a decorator. Story names are the
state names (`Default`, `Busy`, `Unavailable`, `LongLabel`, `Error`). Reviewer checks coverage of
each state in the component's DESIGN.md entry.

## Risks

1. **Peer/version mismatch** (Vite 8, TS 6, ESLint 10, Vitest 5 are very recent). Mitigation: T1
   starts with install + `storybook dev` + `build-storybook` on an empty story before writing any
   others; report immediately if broken.
2. **Dependency size** (several hundred transitive packages, dev-only, accepted by the human).
   `package-lock.json` grows; no effect on the app bundle or Cargo.
3. **`npm audit` / install scripts**: Storybook pulls `esbuild`, `@vitest/*` types, etc. Review
   `npm install` output; do not add `--force`.
4. **Overlay components in jsdom** (Dialog focus trap, Popover positioning) may need decorators
   or `play` workarounds in the render test; accept a story rendering closed only if it also has an
   interactive open story.
5. **Drift**: stories are code, typed against the real props, so a prop change breaks `tsc`
   (failing check). Visual drift is handled by shared global CSS.
6. **`app.css` global rules vs Storybook chrome**: only the iframe loads them; manager UI is
   unaffected.
7. Storybook writes `storybook-static/` and caches under `node_modules/.cache`; both ignored.

## Test plan

- Vitest `src/ui/stories.test.tsx`: coverage guard (+ self-check with fake folder list), glob guard,
  render of every story, storybook-not-in-app guard with self-check. Mutation proof by the
  developer: delete one stories file, make one story throw, import storybook from `src/main.tsx`;
  each must fail `npm test` (state in handoff).
- Existing guards stay green (`boundary.test.ts`, `cssImport.test.ts`, `tokens.test.ts`: the tokens
  story adds no CSS and no literal colours; stories contain no hex colours either, use tokens).
- Manual/QA: `npm run storybook` shows every component and the tokens page; screenshot a few stories
  next to the same component in the app (button, source-popover pieces, dialog) and compare colours,
  fonts, spacing; `npm run build-storybook` succeeds; `npm run build` output has no Storybook
  strings; `npm run check` green.
- e2e: no change (no app UI changes).
