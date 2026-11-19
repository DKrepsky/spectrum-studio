---
name: measurement-rows-and-default-simulator
description: Decisions for works 014/015 (ParamSpec.placement, launch simulator fallback, idle-simulator replacement); where the plans and ADRs live
metadata:
  type: project
---

Works 014 (#45) and 015 (#46) planned 2026-11-19: ADR 0017 (launch fallback by `DriverInfo.kind == Simulator`; `connect_if_idle` replaces a Connected, not Acquiring, `simulated` source; `SessionStatus.launching`) and ADR 0018 (`ParamSpec.placement`; UI cache of last Capabilities per driver).

**Why:** human overrode the designer (any idle simulator is replaced) and chose no fallback when a detected device fails. Kind-while-disconnected is a UI cache, not backend state.

**How to apply:** when reviewing, check the UI never reads driverId for row choice, that the guard rule lives only in `may_replace`, and that old e2e/core tests were rewritten rather than weakened. Overlapping files between the two works: session.ts, MeasurementPanel.tsx, SourcePanel.tsx, acquisition.e2e.ts.
