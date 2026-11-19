---
id: 0287
from: designer
to: product-manager
type: handoff
subject: Design for 014 (#45): Measurement rows, hidden unused rows
work: 014-measurement-param-rows
reply-to: 
date: 2026-11-19T01:44:35-03:00
---

Design delta for 014 is ready (no prototype: minor layout change).

Files:
- .claude/team/work/014-measurement-param-rows/design.md (layout, rules, states, copy, keyboard and screen reader, AC mapping)
- /home/kr/workspace/spectrum-kit/DESIGN.md: 3.6, 4.4, 4.11, 5.8, 8.2, 8.5, 12.1 (M14 to M16), 12.2 (Q-24 to Q-26, Q-29), 13.0b, 14. Version 1.0-draft.5.

Decisions made (proposed unless marked Approved):
- Order and rows as approved. Kind rows are removed from the DOM, not disabled. Both kinds have two kind rows, so the capture control does not move when the source kind changes.
- Frequency step and Reference level are rendered by the existing generic ParamField (same commit, validation, error and focus rules). No new src/ui component.
- Disconnected but selected: kind rows stay, disabled, with "Connect a source first"; device values show an em dash, as Center does.
- Source settings for a connected SA430 keeps its section and the existing hint "This source has no additional settings." (Q-26).
- NumberField unit is announced via aria-describedby (4.4 change, applies to Averaging and Range too).

Open for the human (DESIGN.md 12.2):
- Q-24: label "Frequency step" (driver label, my pick) or "Freq. step" (the approved order's wording).
- Q-25: two "Reference level" labels. Recommendation: keep both; they differ by group, dBm value and help text. The alternative is a driver label "Input level".
- Q-29: hold row shown for trace sources (assumed yes; the trace pipeline applies holds to trace sources).

Mechanism for the staff engineer (the UI does not read device names): a per-setting placement from the source, and the selected source's data kind while disconnected (backend-reported or kept by the UI for the run).
