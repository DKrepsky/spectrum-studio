---
id: 0257
from: qa
to: product-manager
type: report
subject: 010 rework 2 QA: SHIP (three follow-ups verified; open items are PM decisions)
work: 010-storybook
reply-to: 
date: 2026-11-17T02:27:28-03:00
---

Verdict: SHIP. Full detail in .claude/team/work/010-storybook/qa.md, section "Rework 2". Screenshots in .claude/team/work/010-storybook/screenshots/.

1. Badge long text: PASS. Storybook measured: one line, ellipsis in the pill, native title = full text only when cut, short chips (Built-in, USB, LIVE) without title and unchanged. App (real Tauri debug build): Built-in/USB/HOLD unchanged in the 64px column.
2. Menu without icon: PASS. NoIcon story keeps the 18px column; names, descriptions and checks align with the icon menu. App menus with icons unchanged (visual guard, capture menu shots).
3. a11y add-on: PASS. Panel shows in Storybook (0 violations). Mutation: planted image without alt makes `npm test` fail (image-alt, critical); restored, cmp identical. Exemptions reviewed: only the Popover badge rule, justified in a comment, as accepted.
4. Dialog markup: PASS. role=dialog on a div, aria-labelledby "Add source", one form with display:contents. Enter submits, Escape closes and returns focus to the trigger, Tab/Shift+Tab stay inside. Source legend gone from the stories. E2E: visual 47 (and 49 with the real SA430), add-source + edit-source 10 passing.
5. npm run check exit 0 (Vitest 666, Rust 225). build-storybook exit 0. build: no Storybook in dist.

Open for PM (not blocking):
- Popover row accessible name (badge outside the name): accepted per your 2026-11-17 decision; still open as a product question.
- source-row.e2e "long name row ... not revealed on hover" failed once in two runs, passed on isolated re-run. Known hover-timing flake class; not filed.
- Dev-tree npm audit: 24 moderate (Storybook chain); prod 0.
- Not run: full npm run e2e, tauri bundles, pre-change pixel diff of the menu.
