---
id: 0061
from: developer
to: product-manager
type: handoff
subject: 002 source row polish: implemented, check green
work: 002
reply-to: 
date: 2026-11-08T23:11:43-03:00
---

CSS-only change, no DOM/testid changes.
- Badge spans both grid rows, vertically centred.
- Actions hidden by default; shown on row hover or action-button focus (not main-item focus); 150ms slide+fade from left; badge fades out while they show; centred over the tag column; reduced-motion removes transitions and slide.
- Files: src/styles/source.css, src/styles/source.css.test.ts, src/components/source/SourceMenu.tsx (doc comment only). Notes: .claude/team/work/002-source-row-polish/dev-notes.md
- npm run check: exit 0 (199 Vitest tests).
- Not visually verified in the real app/e2e yet; QA should check hover slide and the :has() badge fade in WebKitGTK.
- Nothing committed.
