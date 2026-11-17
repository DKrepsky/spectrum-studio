---
id: 0152
from: designer
to: product-manager
type: handoff
subject: DESIGN.md 1.0-draft.2 and design.md revised per review r1; prototype fixes updated
work: 009-design-system
reply-to: 0151
date: 2026-11-16T17:54:50-03:00
---

Review r1 is addressed. Files:
- /DESIGN.md (1.0-draft.2, 2026-11-16): metadata and authority (0), decision statuses (0.3), normative token file (Appendix A) with tests (2.18), explicit rgba, separate scrims, focus tokens (2.7), corrected large-text rule and computed contrast tables (9.2 to 9.4), target sizes (9.9), disabled states at 0.6 (2.15, 9.10), popover vs menu with keyboard rules (4.11, 5.1), live-region policy (9.6), source lifecycle (5.2), readout selection (5.3), tooltips and patterns (5.4, 5.5), spectrum section (6), performance and integrity (7), measured width ranges and status-bar priority (3.2, 3.4, 3.9), decision register and open questions (12), changelog (13), known gaps (14).
- .claude/team/work/009-design-system/design.md: fixes F0 to F15 (F0 rewritten, F9 changed to 0.6, F13 to F15 new), behaviour changes B1 to B8, copy findings, engineering items, inventory, verification.
- prototype/index.html: F9, F0 cards updated; F13, F14, F15 cards added (measured in the browser, screenshots checked).
- measure/: the harness and contrast scripts so QA can re-measure.

Correction to draft 1: Uncalibrated is hidden from 1024 to 1257px, including 1180px (measured). F0 proposal now removes whole items (Frame, then Rate); Uncalibrated is never removed.

Scope for work 009 (your call; the story says "pure refactor of behaviour"):
- Recommended in 009: B1 (source selector as popover, keyboard: needs Q-18 answer), B2 (live-region policy; approve Q-17 first), B7 (ARIA clean-up, tiny), and the small visual fixes F1, F2, F4, F13, F14, F15 (F9 and F15 are visual changes to approve).
- Separate work items or bugs: F0 (bug, Q-1), B8 (copy bug, "No source connected" while connecting), B3 (start-up states), B4 (readout keyboard), B5 (peak table cap), B6 (notice cap).
- Scope conflict to resolve: review item 6 asks that the canvas read tokens (E3); the story excludes plot canvas internals. Recommendation: in 009 as a token read only (Q-16).
- Not in 009 (Deferred or Proposed features): keyboard plot interaction (Q-8), trace line styles (Q-9), waterfall colour strip (Q-10), custom tooltip, segmented/tabs/context menu/confirmation patterns, touch, connect cancel (Q-12), drag-select (Rejected).

New or changed open questions (all in DESIGN.md 12.2, each with a recommendation): Q-5 webview zoom beyond 125% (toolbar overlaps below about 780 CSS px; QA to check whether zoom shortcuts work), Q-6 toolbar status word, Q-11 stale threshold 2 s is wrong for slow sweeps (bug candidate; needs the staff engineer), Q-13 devices without serial or duplicate ids, Q-22 switching source while acquiring (stops the acquisition and clears the trace with no notice today; recommend other rows unavailable while acquiring).

Human decisions needed at the gate: Q-1 and Q-4 (F0 and removal order), Q-2 (copy Play), Q-3 (opacity 0.6), Q-17 and Q-18 (live regions, type-ahead), Q-16 (E3 scope), Q-22.

Other items for you: docs/README.md does not link DESIGN.md yet (story acceptance); the ADR for the ui/feature boundary and tokens is the staff engineer's; the user guide still says "Play" (C2).

Handled: 0151. No production code changed; npm run check not run.
