# 009 Design system — outcome
Status: accepted by the human 2026-11-17; committed and pushed.

| Acceptance criterion | Result | Evidence |
| --- | --- | --- |
| /DESIGN.md best-practice, linked from docs/README.md | Pass | DESIGN.md 1.0-draft.4; qa.md AC1 |
| Tokens single source (colour, spacing, size) | Pass (after BUG-3) | src/styles/tokens.css; tokens.test.ts guards (colour/shadow/radius/z-index/px sizes, Appendix A equality, contrast) |
| src/ui presentational components | Pass | 17 folders; boundary.test.ts + ESLint (probe import fails both) |
| Feature code uses src/ui, duplicates removed | Pass | 19 feature files; only SourceButton raw (accepted); capture.css, sourceDialog.css, legacy layer deleted |
| Unit tests per ui component | Pass | every src/ui folder; 526 Vitest tests |
| ADR + boundary guard | Pass | docs/adr/0015-*; cssImport.test.ts, boundary.test.ts |
| Looks the same except approved fixes | Pass | qa.md difference table; F0–F17 in decisions.md; compare-* crops; after-final-r3 |
| npm run check + e2e green; docs updated | Pass | PM-run npm run check exit 0 (526 tests); QA full e2e 11/11; real SA430 run green on rerun |

Known residual: intermittent row-action hover e2e flake (green on rerun); reduced motion not exercised in WebKitGTK; zoom unsupported (Q-5).
Backlog: docs/roadmap.md "Backlog (from work 009)".
Human decision: accepted ("I accept it, commit and push the changes").
