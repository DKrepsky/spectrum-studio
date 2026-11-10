# 006 Outcome
Status: accepted 2026-11-10 with two adjustments (no full QA re-run, per human)

| Criterion | Result | Evidence |
| --- | --- | --- |
| Split control, mode label + chevron menu | Pass | qa.md §4; screenshots/menu-open-*, single-idle-* |
| Purple Single / teal Continuous, AA contrast | Pass | qa.md (10.21:1, 6.31:1, hover 4.95:1) |
| Continuous = old Play/Pause | Pass | continuous-* screenshots, acquisition e2e |
| Single: one sweep, auto-stop, again, cancel | Pass (BUG-1 fixed in T7) | sa430-single-*, bug1-retest/ (28/28 cancels on SA430) |
| Backend auto-stop via SessionStatus | Pass | Rust session tests, SA430 session tests |
| Default Continuous, persisted, validated | Pass | persistence e2e, store tests, restart screenshot |
| Locked while acquiring, disabled while disconnected | Pass (busy state not observable in real app; unit-tested) | chevron-locked, disabled-* screenshots |
| Averaging → one raw sweep | Pass | single-averaging-4-*, sa430-single-averaging-4 |
| SIMULATED badge removed | Pass | all screenshots |
| A11y / keyboard / no layout shift | Pass | keyboard-* screenshots; control 154×30 px in all states, 0 overflow at 1024 (WebKitGTK) |
| Tests + check | Pass | PM ran `npm run check` 2026-11-10: exit 0; e2e: only 4 pre-existing visual failures |

Residual (in docs/roadmap.md): pre-existing e2e failures; late-cancel announcement race; SA430 cancel waits for the in-flight sweep (~0.1 s); test hygiene items.
Uncommitted: QA-only `e2e/specs/qa-capture-tour.e2e.ts` + seed (gated env vars).

Human feedback at acceptance: remove the menu footer ("Changing the mode does not start a capture." + separator); main button red while acquiring (Pause/Stop), using --danger #ff6b6b (6.91:1). Done by developer; PM checked final-*.png screenshots and ran `npm run check` (exit 0). QA tour spec dropped.
