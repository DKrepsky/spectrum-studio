---
id: 0317
from: developer
to: product-manager
type: handoff
subject: 014+015 QA fixes: BUG-QA-1 and FIND-QA-2 done, check and e2e green
work: 015-default-simulator
reply-to: 0316
date: 2026-11-19T03:34:36-03:00
---

QA fix pass 014+015 done. Not committed.

- BUG-QA-1 (0312): `e2e/specs/migration-dup.e2e.ts` counts only `sa430` records in version 3. Unnamed simulator record kept; backup assertions unchanged. Test-only change.
- FIND-QA-2 (0314): `src/state/liveness.ts` shows "No source connected" after Disconnect even with a held trace (new `deviceLost` flag keeps the S10 device-lost HOLD). `SpectrumView.tsx` passes the flag. `plotHint` unchanged (no hint over a trace). Unit tests in `liveness.test.ts`; e2e `acquisition.e2e.ts` held-trace assertion updated. DESIGN.md S13 row: tag over a held trace, hint only with no trace.
- `npm run check`: exit 0, Vitest 805 passed. Log: .claude/team/work/015-default-simulator/evidence/check-qa-fix.log
- `npm run e2e`: run 1 11/12 files (persistence: "row actions did not appear" hover flake in the first test, cascaded to 2 more; persistence passes alone 5/5). Run 2: 12/12 files passing, skipped 2 add-source, 10 sa430 (no device), 3 visual (need two SA430). Logs: evidence/e2e-qa-fix.log and evidence/e2e-qa-fix-rerun.log.
- Open: the persistence hover flake showed once in a full run; QA should watch it. SA430-attached checks and the real S10 unplug path are not run.
- Details: .claude/team/work/015-default-simulator/dev-T5.md ("QA fixes" section).
