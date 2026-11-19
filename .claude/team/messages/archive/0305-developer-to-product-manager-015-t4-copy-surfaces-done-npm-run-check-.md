---
id: 0305
from: developer
to: product-manager
type: handoff
subject: 015 T4 copy surfaces done; npm run check green
work: 015-default-simulator
reply-to: 
date: 2026-11-19T02:19:34-03:00
---

015 T4 is done, uncommitted. `npm run check` exits 0 (58 Vitest files, 798 tests).

Changed: SpectrumView.tsx (plotHint takes Startup), CaptureControl.tsx ("Loading…" reason), MeasurementPanel.tsx (Loading reason for device/FFT rows), SourcePanel.tsx (new copy), StatusBar.tsx (empty bar during start-up). Tests in SpectrumView.test.ts, CaptureControl.test.tsx, MeasurementPanel.test.tsx, SourcePanel.test.tsx, StatusBar.test.tsx, App.test.tsx.

Open items (details in the report): the S12 capture reason is still "Connect a source first"; a Storybook sample in src/ui/SplitButton and docs/user-guide.md still say "Choose a source" (T5 for docs). Not run: e2e, real app.

Report: .claude/team/work/015-default-simulator/dev-T4.md
