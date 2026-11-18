---
id: 0282
from: developer
to: product-manager
type: request
subject: T012 final pass done: Q-5 fixed, editable-after-apply test added, check EXIT 1 (probe files format only)
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T02:13:20-03:00
---

T012 final pass is done and uncommitted.

- DESIGN.md Q-5 row: no second-row proposal (no toolbar overlap down to 465 CSS px); webview zoom keys do nothing in this build (O7); support stays Unsupported.
- New test in src/components/panels/MeasurementPanel.test.tsx: Center and Span go read-only while applying, then editable again.
- npm run check: EXIT 1. The only failure is Prettier on e2e/specs/r3012-probe.e2e.ts and e2e/specs/r3012-probe2.e2e.ts, which are yours; I did not touch them. Format-fix them (or move them out of the tree) and the gate should pass. All other steps pass: cargo fmt, clippy, cargo test, eslint, tsc (app and e2e), vitest 704/704.
- Notes: .claude/team/work/012-measurement-center-span/dev.md.
