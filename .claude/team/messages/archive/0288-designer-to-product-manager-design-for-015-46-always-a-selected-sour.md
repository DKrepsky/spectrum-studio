---
id: 0288
from: designer
to: product-manager
type: handoff
subject: Design for 015 (#46): always a selected source, simulator fallback
work: 015-default-simulator
reply-to: 
date: 2026-11-19T01:44:35-03:00
---

Design note for 015 is ready (no prototype: no new screen).

Files:
- .claude/team/work/015-default-simulator/design.md (launch and selection rules, states, copy, focus and announcements, AC mapping)
- /home/kr/workspace/spectrum-kit/DESIGN.md: new 5.2.10 (start-up and selected source), 5.2.2 (S0, S1 retired, S9, S10, S12, new S13), 5.2.7, 5.2.8, 5.8, 4.3, 4.11, 8.2, 8.5, 9.12, 12.1 (M17 to M23), 12.2 (Q-27 to Q-31), 13.0b, 14.

Approved from #46 (as written): a source always selected; simulator selected and connected (not acquiring) with no device; detected device at launch; a device replaces an idle simulator and never interrupts acquisition; disconnect keeps the selection.

Proposed by me, for confirmation:
- R8 / Q-27: a detected device that fails at launch stays selected in Failed; no silent simulator fallback.
- R6 / Q-28: a simulator the user picked is never replaced; "auto-started" means connected by the launch rule with no pick since.
- Q-30: pull B3 (start-up "Loading…", "Status unavailable") into 015. Without it the button still shows "Choose a source" at launch, which #46 removes.
- R10: forgetting the selected source when it is not connected selects the Signal simulator.
- R11: the Signal simulator is always in the popover's fixed block, never under Your sources.
- Q-31: S13 (selected, not connected) shows the name and an idle dot; the plot tag and status bar say "No source connected"; the hint reads "Not connected. Use the source button to connect." No visible "Disconnected" word on the button.
- Retired copy: "Choose a source", "Choose a source to begin. Try Signal simulator.", "Choose a source to see its settings." Replaced by "Connect a source to see its settings." and the S13 hint.

Needs the staff engineer before implementation:
- ADR 0014 says "never replace a source". R4 and R6 need an amendment or a new ADR.
- The selected source's kind while disconnected (014 section 4).
- How remembered simulator entries are listed (R11).
