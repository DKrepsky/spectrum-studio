---
id: 0241
from: staff-engineer
to: product-manager
type: handoff
subject: 010 plan ready: Storybook 10, one developer task
work: 010-storybook
reply-to: 
date: 2026-11-17T01:21:29-03:00
---

Plan: .claude/team/work/010-storybook/plan.md. Draft ADR: docs/adr/0016-storybook-component-catalogue.md. Task: tasks/T1.md (single developer task, not parallelisable: shared config files).
Approach: storybook + @storybook/react-vite ^10.6.7 (peers cover Vite 8, React 19, TS 6), no addons. Stories beside components; tokens page is a TSX story parsing tokens.css?raw. npm run check fails via a Vitest test (coverage guard per src/ui folder with index.ts + composeStories render of every story + guard that nothing outside stories/tests imports storybook). build-storybook is not in check.
Open concerns:
1. Vite 8 / TS 6 / ESLint 10 / Vitest 5 are newer than Storybook's documented matrix; T1 starts with a spike and escalates if broken.
2. app.css sets overflow:hidden on html/body; preview.css needs a documented override so long pages scroll. vite.config pins port 1420 strictPort; viteFinal must drop it.
3. jsdom can't verify looks: visual match is by QA/dev screenshot comparison.
4. PM/human decisions: DESIGN.md 10.2/10.3 gets two short lines (rule: component ships with stories); CLAUDE.md commands table row proposed for you, not edited by developer; a11y addon proposed as a follow-up issue; ADR is status proposed.
5. Dependency tree is large (accepted by human); lockfile grows, no app bundle effect.
