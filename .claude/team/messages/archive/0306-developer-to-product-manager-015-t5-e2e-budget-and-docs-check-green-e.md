---
id: 0306
from: developer
to: product-manager
type: handoff
subject: 015 T5 e2e budget and docs: check green, e2e 110 passed / 0 failed; no-device launch unverified (SA430 attached)
work: 015-default-simulator
reply-to: 
date: 2026-11-19T02:43:15-03:00
---

T5 done, not committed. Report: .claude/team/work/015-default-simulator/dev-T5.md

- npm run check: exit 0 (re-run after the last spec edits). Vitest 58 files / 799 tests.
- npm run e2e (default, debug binary rebuilt): 12/12 spec files, 110 passing, 0 failing, 17 skipped (10 sa430 env-gated, 5 hardware/placeholder, 2 analyzer-launch pending).
- SA430 run (SPECTRUM_E2E_SA430=1): sa430 10/10 passing (new busy-port test included); add-source + visual 57 passing, 1 skipped.

Decisions needing you:
1. Device isolation: the SA430 is attached, so the no-device launch cannot run here. Launch-state tests (acquisition test 1, startup test 1) and the persistence no-device branch are unverified. They use analyzerAtLaunch() and go pending with an analyzer. Option: an e2e-only launch switch in src-tauri to hide discovery (product change, not done). Otherwise QA runs npm run e2e with the cable out.
2. README screenshot not refreshed (ask: refresh with docs:screenshot?).
3. MeasurementPanel device rows still say "Connect a source first" under S12 (only the capture control was in your decision). One-line change if wanted.

Also: findOverflow now skips .visually-hidden (014 T3 help text was a false positive that cascaded through visual). Persistence has a new seed (named preset "Bench FM setup"). docs/user-guide.md and docs/testing.md updated.
