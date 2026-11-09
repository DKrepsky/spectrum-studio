# 002 outcome
Status: accepted by the human 2026-11-08 (committed)

| Criterion | Result | Evidence |
| --- | --- | --- |
| Tag vertically centred (two-line + single-line) | pass | qa.md AC1, screenshots/rest-two-line, hover-simulator |
| Buttons hidden on open, incl. keyboard-focused row | pass | screenshots/menu-open, focus-keyboard |
| Hover reveal, 150 ms slide from left; leave hides | pass | qa.md AC3 (transition verified; mid-frame not captured) |
| Buttons centred, aligned, in tag column, no overlap | pass | screenshots/hover-two-line, hover-long |
| Reduced motion | not testable in app (WebKitGTK ignores the setting); CSS test only | source.css.test.ts |
| Keyboard: F2/Delete; arrow to action buttons | pass after BUG-1 fix | e2e/specs/source-row.e2e.ts (3 clean runs, revert-proof) |
| Long names ellipsize; row heights | pass | screenshots/hover-long |
| npm run check | pass (PM re-ran, exit 0) | |

## Backlog
- BUG-2 (low, pre-existing): row focused via ArrowDown shows no focus indicator (`.source-item:focus-visible` has no outline).
