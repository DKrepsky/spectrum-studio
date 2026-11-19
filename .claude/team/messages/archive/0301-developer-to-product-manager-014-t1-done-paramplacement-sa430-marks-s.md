---
id: 0301
from: developer
to: product-manager
type: handoff
subject: 014 T1 done: ParamPlacement, SA430 marks step and level, bindings
work: 014-measurement-param-rows
reply-to: 
date: 2026-11-19T02:02:05-03:00
---

014 T1 implemented (not committed). Report: .claude/team/work/014-measurement-param-rows/dev-T1.md

- Core: `ParamPlacement { Source, Measurement }` + `ParamSpec.placement` (serde default), `in_measurement()`. Bindings regenerated: `src/bindings/ParamPlacement.ts` (new), `ParamSpec.ts`.
- SA430: `stepKhz` and `refLevelDbm` are `Measurement`; order and text unchanged. 3 new tests.
- Docs: `docs/sources.md` placement bullet.
- TS test/fixture literals got `placement: 'source'` (needed for tsc): fixtures.ts, ParamForm.test.tsx, SourceMenu.test.tsx, sourceEntries.test.ts (015 T3's files, field only).

Checks: fmt and clippy clean; core lib 100, session 25, probe 8, remember 16 pass; sa430 lib 36 pass; vitest on ParamForm and sourceEntries pass.

Not green, not mine:
- `autoconnect::connect_if_idle_leaves_a_connected_source_alone` fails: 015 T1 changed `connect_if_idle` to replace an idle simulator. Its test is 015's. Passes at HEAD.
- `SourceMenu.test.tsx` 3 failures in "Your sources" (015 T3 in-progress).
- `tsc`: `fixtures.ts` `launching` (015 T1).
- `SessionStatus.ts` bindings changed by 015's `launching` field: do not commit it with 014.
So `npm run check` is red in this checkout until 015 lands. Merge order: 014 T1 can land with 015 once those are fixed.
