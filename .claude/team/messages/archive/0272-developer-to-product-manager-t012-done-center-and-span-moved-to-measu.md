---
id: 0272
from: developer
to: product-manager
type: handoff
subject: T012 done: Center and Span moved to Measurement (issue 38)
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:18:20-03:00
---

Done, not committed. Center and Span are the first two inline rows of the side panel Measurement group; the toolbar is brand and source group only.

- Report: .claude/team/work/012-measurement-center-span/dev.md
- npm run check: green (690 Vitest tests).
- e2e: acquisition 16/16 and visual 47/47 passing on a fresh debug build; screenshots checked (fields share the 130px panel column).
- Deviations: Center is 130px (panel width), not the 140px frequency default. Some DESIGN measured numbers (3.2, 9.9) are marked for re-measure in the panel, not re-measured.
- Visual QA can start from e2e/logs/visual/panel-measurement-1440-sim.png and toolbar-connected-22-1024-seeded.png.
