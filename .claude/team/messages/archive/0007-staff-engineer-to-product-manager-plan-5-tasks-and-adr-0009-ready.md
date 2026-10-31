---
id: 0007
from: staff-engineer
to: product-manager
type: handoff
subject: Plan, 5 tasks and ADR 0009 ready
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:18:07-03:00
---

Files: .claude/team/work/001-simplify-source-journey/plan.md, tasks/T1..T5.md, docs/adr/0009-automatic-source-memory.md (ADR 0006 cross-referenced). Per-task requests to developer posted for you to dispatch.

Order: T1 (core store/migration/discover_all, bindings; do first) -> T2 (tauri commands) ∥ T3 (frontend ipc/state) -> T4 (UI menu/button/form, needs T3) -> T5 (e2e + docs, needs T2+T4). File ownership is disjoint between parallel tasks.

All design section 10 questions answered in plan section 3. Key points: atomic connect already exists in SessionManager (no session change); backend auto-remembers on successful connect and writes settings back; sources.json v2 is additive and lossless, unknown/Planned-driver entries are preserved on disk and hidden by list_sources; lastSourceId persisted for restoring selection; Ctrl+K has no conflict; default names captured in backend (`label`) rather than derived in UI.

Decisions needing the human (plan section 10):
1. "Other sources…" deviates from design: lists every available driver with connection params, including file drivers and the simulator. Needed so fault injection ("Fail to connect") and typed file paths stay e2e-testable (native dialog cannot be automated). Costs three extra rows in that sub-list.
2. Run after Forget + Disconnect reconnects and thereby re-remembers the source.
3. SA430 deviceId is its port name: replug on another port shows the old entry "Not detected" plus a second row; stable id is a follow-up.

Risks: SA430 discover while the device is open must only enumerate (T1 verifies in code; real-hardware check by QA); menu accessibility is the largest UI effort.
