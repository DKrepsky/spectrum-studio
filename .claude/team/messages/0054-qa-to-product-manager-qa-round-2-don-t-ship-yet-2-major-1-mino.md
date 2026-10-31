---
id: 0054
from: qa
to: product-manager
type: report
subject: QA Round 2: don't ship yet (2 major, 1 minor)
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T15:50:07-03:00
---

Verdict: DON'T SHIP YET (2 major bugs, small fixes). Full matrix + per-screenshot findings: .claude/team/work/001-simplify-source-journey/qa.md ("Round 2"); screenshots in screenshots/r2/.

Gates (real output): npm run check exit 0 (Rust 108+2+8+11+13+14+8, clippy clean, Vitest 200/200); npm run e2e exit 0, 10 spec files passed; SPECTRUM_E2E_SA430=1 e2e:run exit 0, sa430 spec 6 passing on the real device, visual guard 18 passing, 1 skipped (needs 2 analyzers).

Criteria: 1 Add source dialog (Name/Driver SA430 only/Port/Test/Save/Cancel, inline OK+fail, Test does not disturb a running source, Save does not connect): PASS. 2 One row: PASS for migrated real sources.json copy (2 dups -> 1 row, backup written, rename survives restart), tested and connected; FAIL for untested Add of a detected device's port (two rows) = BUG R2-1. 3 Name overflow: PASS at 1180 and for 22 chars at 1024; FAIL for 60 chars at 1024 (toolbar 39px wider than window, Export CSV and side panel cropped) = BUG R2-2. 4 Circles: green/red x/gray/hollow all seen (hollow from a seeded absent device). 5 Edit/F2/Forget+Undo/connected lock/Escape/Tab/no Planned drivers/one banner/corrupt sources.json: PASS; minor R2-3 (button keeps forgotten name).

Bugs: 0048/0049 R2-1 major, 0050/0051 R2-2 major, 0052/0053 R2-3 minor.

NOT VERIFIED: replug on another port (physical; only Rust tests), real unplug, "Different device" state (needs a 2nd analyzer), newer-valid-version file in the UI (Rust test only).

Note: the REAL ~/.config/io.github.spectrumstudio/sources.json was already migrated (v3) with a sources.pre-v3 backup before my run (by an earlier run, not me); I never wrote there. Probe specs and seeds deleted.
