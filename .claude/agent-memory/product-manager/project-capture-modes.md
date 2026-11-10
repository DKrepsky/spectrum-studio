---
name: project-capture-modes
description: Work 006 capture modes (single/continuous): human's UI decisions, colour semantics, what was accepted 2026-11-10
metadata:
  type: project
---

Work 006 (accepted + committed 2026-11-10): split capture button (mode label + chevron menu). Colour semantics chosen by
the human: teal = Continuous idle, purple = Single idle, red (--danger) whenever pressing stops (Pause/Stop). Human removed
the SIMULATED badge (simulator identified by source name) and the menu footer hint ("not needed") — prefers minimal copy.
Single = exactly one raw sweep even with averaging (human chose this over "full averaged trace").

**Why:** human wants an uncluttered toolbar and colour that signals action/state at a glance.
**How to apply:** keep red for stop actions and avoid explanatory helper text in menus unless asked. Backlog from 006
(pre-existing e2e failures, late-cancel announcement race, interruptible SA430 reads) is in docs/roadmap.md.
Related: [[feedback-acceptance-process]], [[feedback-small-tweaks]].
