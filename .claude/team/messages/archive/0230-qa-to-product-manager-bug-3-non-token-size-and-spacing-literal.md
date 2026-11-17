---
id: 0230
from: qa
to: product-manager
type: bug
subject: BUG-3 non-token size and spacing literals in CSS (AC2)
work: 009-design-system
reply-to: 
date: 2026-11-16T23:44:28-03:00
---

Summary: the token guard covers colour, shadow, radius and z-index only. About 60 size and spacing literals remain outside tokens.css: app.css (33, e.g. font-size 11px x4, gap 6px, padding 7px, left 76px, width 330px), source.css (outline 2px, min-height 17px), SourceDialog.css (3), ui Button.css (12px icon slot), ui Menu.css (16px column). DESIGN 2.17: anything else is a finding; DoD "no non-token literal left in CSS" not met.
Severity: minor (no visible change found; AC2 not met)
Steps to reproduce: grep -rnE '[^a-z-][0-9]+(\.[0-9]+)?px' src --include=*.css | grep -v tokens.css | grep -v '1px\|0px'
Expected: tokens or calc() of tokens, or named geometry tokens pinned by a contract test; the guard fails on them.
Actual: literals present, guard silent.
Evidence: list in .claude/team/work/009-design-system/qa.md (BUG-3).
Suspected area: src/styles/app.css, src/components/source/source.css, SourceDialog.css, src/ui/Button/Button.css, src/ui/Menu/Menu.css; src/styles/tokens.test.ts (literalViolations).
