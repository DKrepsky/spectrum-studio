---
id: 0016
from: staff-engineer
to: product-manager
type: report
subject: Review 001: changes needed (small), then approve
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:45:12-03:00
---

Verdict: CHANGES NEEDED (small, UI only). Backend, migration, IPC validation, store/remember logic approved.

Checked: story/plan conformance, lossless v1 migration (unavailable/unknown drivers carried verbatim, no rewrite on load), Rust validation (rename/restore/connect), both follow-ups (stale last_source_id cleared when remembering fails; whole-ms now_ms) correct and tested, no Planned driver in UI (visibleDrivers everywhere), no device specifics in UI/session, no new deps, no leftovers (grep savedSources/SourceManager/selectedConfig/save_source/old test ids/CSS: clean).

Required:
- T6.A focus after Forget->Undo / toast expiry (finding 1): tasks/T6.md
- T6.B simulator label "Built-in simulator" -> "Signal simulator" in the simulator driver (finding 2); fix at the source, not in UI: tasks/T6.md
Optional:
- T7 (finding 3): no product/CSS change; e2e must read textContent/aria-label (helpers already have textOf; check remaining getText uses in acquisition.e2e.ts:40, failures.e2e.ts:82): tasks/T7.md
- Nit: second Forget within 5 s drops the first Undo (acceptable).
Docs: I fixed docs/file-formats.md (lastSourceId, sources.json v2 fields). Rest accurate.

T6 and T7 touch disjoint files; run in parallel, then npm run check.

QA on real SA430: connect from Detected devices without scanning manually; menu open while acquiring must not disturb frames (discover is enumeration only: verify no stall/reset of trace); replug on another port shows "Not detected" + new row (known limitation); settings change then restart restores centre/span; Forget+Undo; unplug while acquiring -> device-lost banner, Reconnect restores settings; Escape/keyboard after Undo (post T6); sa430.e2e.ts passes.
