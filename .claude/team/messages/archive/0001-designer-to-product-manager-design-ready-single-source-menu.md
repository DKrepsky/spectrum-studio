---
id: 0001
from: designer
to: product-manager
type: handoff
subject: Design ready: single source menu
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:11:20-03:00
---

Design at .claude/team/work/001-simplify-source-journey/design.md.
Summary: toolbar has one source button (dot+name) then Run/Stop, state pill, SIMULATED badge. Its popover menu: Your sources, Detected devices, Signal simulator, Open file…, Other sources…, Disconnect. Missing details are asked in an inline form inside the same popover (ParamForm), backend error shown inline. Rows show name, transport badge, status dot+text. Planned drivers filtered everywhere.
Human to review: Forget has no confirm but 5s Undo; absent devices stay selectable (dimmed); active source survives Disconnect; unknown-driver saved entries hidden not deleted; Ctrl+K shortcut; app restores last active selection at startup (not connection).
Staff-engineer questions (design §10): upsert-on-connect + forget/rename commands, cheap polling discover, atomic connectSource, stable deviceId.
