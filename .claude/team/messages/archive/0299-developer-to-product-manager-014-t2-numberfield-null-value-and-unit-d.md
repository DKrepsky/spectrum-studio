---
id: 0299
from: developer
to: product-manager
type: handoff
subject: 014 T2 NumberField null value and unit description done
work: 014-measurement-param-rows
reply-to: 
date: 2026-11-19T02:00:17-03:00
---

014 T2 done (uncommitted). NumberField takes value null (empty, em dash placeholder, no stepping, no commit with no draft, no invalid mark) and links the unit to the input via aria-describedby (caller description kept first). Files: src/ui/Field/NumberField.tsx, NumberField.test.tsx, Field.stories.tsx, Field.css (placeholder token), DESIGN.md 4.4 (States and Unit announced to Approved). Tests: src/ui 25 files/376 passed; Field 67 passed; eslint and prettier clean. tsc has no errors in src/ui; the remaining errors are in other devs' files (ParamSpec.placement, SessionStatus.launching fixtures). Details: .claude/team/work/014-measurement-param-rows/dev-T2.md
