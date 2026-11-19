---
id: 0298
from: staff-engineer
to: product-manager
type: handoff
subject: Plan 014 (#45) + 015 (#46): tasks, order, risks
work: 014-measurement-param-rows
reply-to: 
date: 2026-11-19T01:57:10-03:00
---

Plans: .claude/team/work/014-measurement-param-rows/plan.md and .claude/team/work/015-default-simulator/plan.md. ADRs: docs/adr/0017 (simulator fallback + idle-simulator replacement, amends 0014), docs/adr/0018 (Measurement rows from ParamSpec.placement). DESIGN.md (R6/M22/Q-28/changelog) and 015 design.md R6 updated for the Q-28 override. No new dependencies; no new src/ui component.

Mechanism: ParamSpec.placement (measurement|source, default source); SA430 marks stepKhz/refLevelDbm. UI row rule from dataKind + placement, never driverId. Kind while disconnected: UI cache of last Capabilities per driver (not backend; designer preferred backend, rejected in ADR 0018: a source never opened this run has no answer either). Launch: simulator picked by DriverInfo.kind==Simulator; connect_if_idle also replaces a Connected (not Acquiring) simulated source; SessionStatus.launching drives "Loading…". Bindings change in both (ParamSpec/ParamPlacement; SessionStatus.launching).

014 tasks: T1 core ParamPlacement + SA430 + bindings (parallel with T2); T2 src/ui NumberField null value + unit aria-describedby + stories + DESIGN 4.4 (parallel with T1); T3 Measurement rows/Source settings filter/ParamField export/cache/tests/e2e (after T1+T2).
015 tasks: T1 core policy + launching + tests + bindings + docs (parallel with T3); T3 menu: simulator always in fixed block, unnamed simulator entries hidden, "Disconnected" line (parallel with T1); T2 frontend state/startup/selection/SourceButton (after T1+T3); T4 copy surfaces (after T2 and 014 T3); T5 e2e budget + docs (last, after everything).

Order/worktrees: wave 1 in parallel: 014 T1, 014 T2, 015 T1, 015 T3 (disjoint files). Wave 2: 014 T3. Wave 3: 015 T2, then 015 T4. Wave 4: 015 T5. Overlaps to respect: session.ts (014 T3, 015 T2), MeasurementPanel.tsx and SourcePanel.tsx (014 T3, 015 T4), acquisition.e2e.ts (014 T3, 015 T5). 014 and 015 are otherwise independent, so 014 can ship alone before 015 if you prefer separate PRs.

Risks: (1) e2e launch state changes for every spec (T5 budgets; real-device launch/plug-in/failed-device specs are env-gated and need the human's physical test). (2) Failed replace of a simulator by a device leaves Disconnected+Failed on the device (consistent with Q-27). (3) Backend remembers an auto-connect just after publishing Connected: UI list can lag; mitigated by menu-open refresh and identity re-adoption. (4) A device that fails at launch and was never remembered shows "<driver name> · <serial>" instead of "SA430 <serial>" (label exists only after a successful open). (5) Label column width for "Frequency step"/"Reference level" is for QA to measure at 1024/1180/1440. (6) Failed launch device or first run: Measurement rows use the reduced set (Center, Span, Averaging, hold, capture) since no capabilities were reported this run.
Candidate follow-ups for you to decide (not in scope): persist last known runtime specs/kind per driver across launches (e.g. static runtime specs on DriverInfo); setting to turn off the launch fallback. Named legacy simulator presets stay listed under Your sources; only unnamed simulator entries are hidden (R11 refinement, tell the designer).
No open questions blocking.
