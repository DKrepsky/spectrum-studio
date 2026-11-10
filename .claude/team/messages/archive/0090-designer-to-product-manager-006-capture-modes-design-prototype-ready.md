---
id: 0090
from: designer
to: product-manager
type: handoff
subject: 006 capture modes: design + prototype ready for the human gate
work: 006-capture-modes
reply-to: 0089
date: 2026-11-09T21:02:52-03:00
---

Design for 006 is ready for the human gate. Files (all under .claude/team/work/006-capture-modes/):
- design.md: layout, all 15 states, copy, tooltips, aria names, contrast table, keyboard/focus, AC-to-design mapping, backend contract, open questions Q1-Q8.
- prototype/index.html: one file, real tokens, scenario switcher (11 scenarios), width switch 1440/1180/1024, clickable (Play/Pause, chevron menu with arrows/Enter/Esc, source button toggles connection). Source names are mocks.
- prototype/screenshots/: 01-09 at 1440 (continuous idle, continuous acquiring, single idle purple, single in progress, single auto-stopped, menu open, disabled no source, transition stopping, error), 10-13 at 1024 (long name, auto-stopped, menu open, SIMULATED), crop-10..15 (toolbar strips and focus ring).

Recommendation: the human's split button, with three changes.
1. Label = mode ("Continuous" / "Single"), fixed 128px main segment plus a 26px chevron, so switching mode or state never shifts layout. Total about 155px, the toolbar fits at 1024 with no overflow (headless measurement).
2. Colour = mode only: teal continuous, purple single (#a47cff, 6.3:1 on its ink). Pause is no longer amber, so amber stays for warnings.
3. Single in progress shows a Stop square (cancel), and the plot badge says CAPTURING (never LIVE, and never the stale "No data for N s" warning).

Decisions for the human (details in design.md section 11):
- Q1 Pause no longer amber (recommended yes).
- Q2 Single purple vs the SIMULATED lavender badge: different shape, OK?
- Q3 Choosing a mode while disconnected: disabled (recommended, as story) or allowed?
- Q4 Single + averaging: the single capture completes when the averaged trace is complete (recommended). Staff engineer to confirm.
- Q5 Mode is app-level, not per source (recommended).
- Q6 Screen-reader announcements only for single complete, cancel and failure (recommended).
- Q7 Menu closes if acquisition starts from elsewhere, without changing the mode.
- Q8 Real-font width check in WebKitGTK (QA).

Backend contract the UI depends on (staff engineer to own): mode preference persisted and validated in Rust; SessionStatus must report the running mode (suggested acquisitionMode field) and the backend stops the single capture itself; cancel discards a partial sweep; the backend bounds the wait for a sweep. This changes SessionStatus, so bindings and likely an ADR are needed.

No production code changed. Prototype verified by a jsdom click run (start, pause, menu, auto-stop, cancel, Esc focus return).
