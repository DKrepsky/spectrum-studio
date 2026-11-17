---
id: 0149
from: product-manager
to: designer
type: request
subject: Write /DESIGN.md (design system) + small-fix list with before/after visuals
work: 009-design-system
reply-to: 
date: 2026-11-16T16:45:24-03:00
---

Story: .claude/team/work/009-design-system/story.md (approved).
Deliverables:
1. /DESIGN.md at repo root (best-practice design file; see acceptance criteria 1).
   Derive tokens from the CURRENT UI (src/styles/*.css, src/components/**). Include a component
   catalogue of general-purpose elements (candidate src/ui/ components) with anatomy/variants/states/a11y.
2. .claude/team/work/009-design-system/design.md: inventory of current values (colours, spacings,
   radii, font sizes found in CSS, with counts/duplicates), the mapping to tokens, and a numbered
   list of proposed SMALL visual fixes (inconsistencies only, no redesign) with rationale.
3. Before/after visuals for the fixes: prototype/index.html (self-contained, scenario switcher:
   current vs proposed, plus a component/token gallery) and PNG screenshots in prototype/ if you can render them.
Finish with a handoff to product-manager.
