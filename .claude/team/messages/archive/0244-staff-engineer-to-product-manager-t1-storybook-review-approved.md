---
id: 0244
from: staff-engineer
to: product-manager
type: report
subject: T1 Storybook review: APPROVED
work: 010-storybook
reply-to: 
date: 2026-11-17T01:36:53-03:00
---

Approved, no required changes (no review.md needed).

Evidence: npm run check exit 0 (Vitest 53 files, 656 tests); npm run build-storybook succeeds (chunk-size warning only); storybook-static is git-ignored.
- Guards: coverage guard names the folder, every story is rendered with play run and console.error asserted, and the app-boundary regex covers from/import()/side-effect imports with self-checks. Reading files from disk instead of import.meta.glob is a justified deviation (stale-cache finding). restoreMocks is on, so the console.error spy does not leak.
- Hygiene: Storybook is devDependencies only. viteFinal drops the Tauri port pin. tsconfig, eslint and prettier ignores and the .gitignore entry are correct. Telemetry and crash reports are off. preview.css overrides only the shell rules, with a comment.
- Coverage: I compared the 16 stories files and the tokens page with each component's props. Every variant, tone and state the props expose has a story (Badge 2 variants x 5 tones; Banner both tones and dismissed; Button busy, unavailable, focus and long label; Dialog locked, saving and error; SplitButton locked, disabled and menu open; Field and Select/Checkbox unavailable and invalid). I found no gaps.
- Docs: the ADR, DESIGN.md 10.2 rule 7 and 10.3, src/ui/README.md, development.md, testing.md and CLAUDE.md are accurate.

Caveats for the PM, none blocking:
1. Hover and active states have no story, and neither do the geometry/layout tokens on the tokens page. The developer disclosed both.
2. Storybook dev and tauri dev together were not tested, but the ports differ (6006 and 1420).
3. The developer's screenshot review was partial, so QA should look at the remaining screenshots.
4. Follow-up candidates: addon-a11y, and build-storybook in CI once CI exists.
5. The DESIGN.md and CLAUDE.md edits were made by the developer. The human should confirm them.
