---
id: 0219
from: developer
to: staff-engineer
type: handoff
subject: T11 finish: root cause, fix, check and e2e green
work: 009-design-system
reply-to: 0218
date: 2026-11-16T23:25:03-03:00
---

T11 finish (request 0218) done. Nothing committed.

1. Visual red "connected and acquiring with a 22-char name": NOT a T11 CSS/markup change. The failing step is
   `openEditDialog` (before any label or name check). Mechanism (reproduced on purpose): `revealRowActions` hovers
   the row, then the click on `source-edit` comes later with no pointer move. If the list moves under a stationary
   pointer, the actions go pointer-events:none; WebDriver says "element not interactable" and wdio's waitForClickable
   never recovers (it does not move the pointer). Probe: shift the list 60px after the reveal -> old path FAILS with
   the exact error; re-hover of the row right before the click -> PASSES. Trigger in the full run not captured
   (1 red in the last 3 full visual runs; the same error is in 2 earlier logs; the isolated R2-2 block and a later
   full visual run pass).
   Fix: `clickRowAction(entryTestId, 'source-edit' | 'source-forget')` in e2e/specs/helpers.ts (hovers the row
   again, waits for the action, clicks). Used by openEditDialog, persistence.e2e.ts (forget), visual.e2e.ts (forget).
   No assertion weakened, no retry added.
2. Acquisition "single capture takes exactly one sweep": isolated acquisition spec 3/3 green (15 passing each);
   also green in the full run.
3. Orphans: pids 205983 (wdio runner, ~70 min) and 208169 (~60 min), parent 1731, for the deleted t10-shots spec.
   Not mine, not killed. They hold no port 4444 (no listener, no tauri-driver child). My own probe runners were
   killed by PID only.
4. Dialog after-shots: .claude/team/work/009-design-system/evidence/after-T11/ (19 PNG: add empty, filled, invalid,
   testing, failed, long, ok-1180, save-error-1180, saving 1024/1180 (busy, FIFO), edit idle/locked/saving 1180).
   Composites T10-left / T11-right: evidence/compare-T11/ (script make_compare.py beside them). Probe spec and seed
   deleted. Labels muted (stacked) and param group frameless: confirmed in the crops. Details in the PM handoff.
5. `npm run check`: exit 0 (cargo fmt/clippy/test, prettier, eslint, tsc, vitest 52 files / 519 tests).
   `npm run e2e` (tauri build + wdio, first attempt): exit 0, Spec Files 11 passed / 11, visual 47 passing,
   acquisition 15 passing, 0 failing, 104 pass marks.

Deviations / open: after-T11 has no add-ok-1024 shot (only 1180, same as the probe design). The probe's
long-name text differs from T10's, so the long-name diff is not like-for-like.
Memory updated: developer e2e-quirks.md (row-action click), dialog-busy-error-probes.md (FIFO data loss, reloadSession,
distinct ports).
