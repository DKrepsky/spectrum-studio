# 010 Storybook — outcome

Issue: #36. Accepted by the human 2026-11-17 ("Accept and commit", then "fix these issues before committing").

| Criterion | Result | Evidence |
| --- | --- | --- |
| `npm run storybook` lists every src/ui component | pass | 16 components + tokens page (qa.md §1) |
| Stories for each supported state | pass (hover/active not representable without addon) | qa.md §2, staff review |
| Visual match with the app | pass | Vite + real Tauri debug build comparisons, screenshots/ |
| Tokens page | pass | sb-tokens-*.png |
| `npm run check` fails on missing/broken story | pass | QA mutations (missing file, throwing story, axe violation) |
| build-storybook ok, no Storybook in app build | pass | dist grep 0 matches; tauri bundles not run |

Fixed before commit (human's request): Badge long-text ellipsis + title; Menu icon column reserved; addon-a11y
with axe in `npm test` (found and fixed Dialog `form role=dialog`).
Accepted trade-offs: Popover row name excludes badge (DESIGN 9.12, per-story exemption); dev-only npm audit moderates;
intermittent hover e2e flakes = #24.
