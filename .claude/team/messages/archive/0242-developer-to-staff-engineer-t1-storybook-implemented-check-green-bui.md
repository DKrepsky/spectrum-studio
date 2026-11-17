---
id: 0242
from: developer
to: staff-engineer
type: handoff
subject: T1 Storybook implemented: check green, build-storybook ok, mutation proofs done
work: 010-storybook
reply-to: 
date: 2026-11-17T01:35:20-03:00
---

T1 Storybook (issue #36) implemented. Not committed. Work tree: /home/kr/workspace/spectrum-kit.

CHANGED (files)
- package.json: deps storybook@^10.6.7 and @storybook/react-vite@^10.6.7 (devDependencies only); scripts "storybook" (storybook dev -p 6006) and "build-storybook" (storybook build). package-lock.json updated.
- .storybook/main.ts (react-vite, stories glob, core.disableTelemetry, enableCrashReports false, viteFinal drops the Tauri port pin), .storybook/preview.tsx (tokens.css then app.css, fullscreen, padding wrapper), .storybook/preview.css (releases html/body height and overflow for scrolling story pages; nothing else).
- tsconfig.json include adds .storybook/*.ts and *.tsx (a dot folder needs explicit globs); eslint.config.js ignores storybook-static; .gitignore /storybook-static; .prettierignore storybook-static.
- src/ui/stories.test.tsx: guards (see below).
- 17 stories files: one per component folder with an index.ts (Badge, Banner, Button, Dialog, Field [covers Field/TextField/NumberField/FrequencyField/Select/Checkbox], IconButton, InlineMessage, LiveRegion, Menu, Popover, Section, Spinner, SplitButton, StatusDot, StatusStrip, Table) plus src/styles/Tokens.stories.tsx (title "Design system/Tokens", reads tokens.css with ?raw, parses with the test helper parseTokens/resolveToken, inline style var() only).
- Docs: DESIGN.md 10.2 rule 7 and one line in 10.3 (human owns DESIGN.md, flagged); src/ui/README.md; CLAUDE.md commands table two rows (PM decision); docs/development.md commands; docs/testing.md stories row; ADR 0016 status set to accepted.

GUARDS (src/ui/stories.test.tsx, 130 tests, in npm test)
- Coverage: every src/ui folder with index.ts has <Folder>/<Folder>.stories.tsx; failure names the folder. Self-check with fake lists.
- Every stories module has a default title and at least one story.
- Every story composed with composeStories renders, runs play, and must not throw or call console.error; the container must have content or a portal must exist.
- Boundary: no app file (src/**, not *.stories.tsx, *.test.ts(x), src/test/) imports storybook, @storybook/* or a .stories path. Self-check included.
- Design choice: the stories list is read from disk with readdirSync and dynamic import, not import.meta.glob. Vitest's fsModuleCache kept a stale glob result for an unchanged test file (found during mutation proof 1), so a removed file was not noticed.

COMMANDS AND RESULTS
- npm i (install): 71 packages added, no peer warnings. npm audit: 24 moderate, all dev-only. Most are existing eslint and wdio chains (glob/minimatch); Storybook adds the @joshwooding docgen plugin's glob chain. I did not measure the pre-change baseline, so the exact delta is unverified.
- npm run storybook (dev): ready on :6006, index.json lists 107 entries.
- npm run build-storybook: exit 0, storybook-static/ (6.9 MB, git-ignored). Chunk-size warning only.
- npm run build: exit 0. grep -ril storybook dist: 0 matches.
- npm run check: exit 0 (cargo fmt, clippy -D warnings, cargo test, Prettier, ESLint --max-warnings 0, tsc app and e2e, Vitest 53 files / 656 tests).

MUTATION PROOFS (logs in /tmp/claude-1000/-home-kr-workspace-spectrum-kit/fa28c594-0588-4dc7-860d-c6812292550b/scratchpad/mut/)
1. Removed src/ui/Badge/Badge.stories.tsx: "no <Folder>/<Folder>.stories.tsx for: Badge" (fail), restored, then pass (130/130).
2. Added to Button.stories.tsx a BrokenRender (throws in render) and BrokenPlay (throws in play): both fail "render boom" and "play boom"; restored (cmp OK).
3. Added import 'storybook/test' as line 1 of src/main.tsx: "no app file imports Storybook ... src/main.tsx imports storybook/test" (fail); restored (git diff clean).

SCREENSHOTS (.claude/team/work/010-storybook/screenshots/, headless Chrome on the static build)
- sb-button-primary, sb-button-states (busy), sb-button-unavailable, sb-button-long-label, sb-dialog-idle, sb-dialog-saving, sb-table-default, sb-tokens (full page), sb-splitbutton-acquiring, sb-splitbutton-continuous, sb-popover-row-actions, sb-statusstrip-narrow, sb-banner-error-alert, sb-field-invalid.
- app-toolbar-reference.png: the real app UI from the Vite dev server (no Tauri backend, so the invoke error banner is expected). The toolbar's teal Continuous split button matches sb-splitbutton-continuous (colour, chevron geometry, label weight). I reviewed the Dialog saving, tokens, split acquiring and split continuous shots by eye. The other shots are not yet reviewed, so QA should look at them.

OPEN CONCERNS
- No Storybook story can show hover, active or :focus-visible on its own (no pseudo-state addon, on purpose). Focus is covered by play functions; hover and active are not.
- Badge, IconButton, Table and others have no busy or error state, so no story for them; each story set covers what the component supports.
- Tokens page uses inline style with var() only (plan allowance, no CSS file under src). It shows the palette, semantic colour, type, spacing and radius, but not the geometry or layout tokens.
- Stories are typed against real props; Field and Dialog wrappers hold refs and controlled state.
- Vite chunk warning on build-storybook is only informational.
- Storybook does not run in CI (no workflows in the repo); build-storybook is manual, as planned.
- No bug found in a component during stories. No component file was changed.
- Storybook dev listens on :6006 and has not been run alongside tauri dev, which uses :1420; viteFinal drops the strictPort pin, so they should not clash. Not tested together.
