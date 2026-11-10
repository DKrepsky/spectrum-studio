# 006 Single-shot and continuous capture modes
Status: accepted
As a user measuring a signal, I want to choose between a single-shot capture (one sweep, then stop
automatically) and continuous capture, so that I can grab one clean trace to inspect without
pausing by hand.

## Acceptance criteria
- [ ] The toolbar capture control has two parts: a main button whose label shows the current mode
      (e.g. "Single" / "Continuous") plus the play/pause action, and a dropdown arrow on its right
      that opens a menu to pick the mode. (Exact layout, icons and copy per approved design.)
- [ ] The main button colour reflects the mode: purple for single shot, the existing accent for
      continuous. Both colours meet WCAG AA contrast for their label/icon in all states.
- [ ] Continuous: behaves exactly like today's Play/Pause (start → frames keep arriving; Pause stops
      and freezes the last trace).
- [ ] Single shot: pressing the button acquires exactly one complete frame/sweep, shows it, then the
      acquisition stops automatically; the trace stays on screen and the button returns to its idle
      state. Pressing it again takes a new single capture. While a single capture is in progress the
      user can cancel it.
- [ ] The auto-stop is done by the backend and reported via `SessionStatus`; the UI never assumes it
      (no UI timer). Works for every source (simulator, SA430) without device-specific code in UI/session.
- [ ] Mode defaults to Continuous on first run and is remembered across restarts (validated in Rust
      when loaded).
- [ ] Mode changes while acquiring follow the approved design (design.md). The whole control is
      disabled while disconnected (human, 2026-11-09).
- [ ] With averaging (or any multi-frame processing) enabled, a single capture delivers exactly one
      raw sweep and stops (human, 2026-11-09).
- [ ] The SIMULATED toolbar badge is removed (human, 2026-11-09). Simulator honesty stays via the
      source button name ("Signal simulator") and its accessible name.
- [ ] Disabled/tooltip/a11y rules from 003 still hold: disabled without a connected source and during
      transitions; keyboard-operable menu (arrow keys, Enter, Esc); accessible names state mode and
      action; visible focus ring; no layout shift between modes/states.
- [ ] Rust + frontend unit tests and e2e updated; `npm run check` passes; QA screenshots of both modes
      in idle/acquiring/disabled/menu-open states.

## Out of scope
Triggered capture (level/external trigger), "N sweeps" counts, timed captures, keyboard shortcuts,
saving/exporting the captured trace (no file features).

## Notes / constraints
- Human asked for a designer review with freedom to propose better ideas, and a prototype
  screenshot for approval before engineering.
- Design approved by the human 2026-11-09 (design.md + prototype). Decisions: Q1 Pause no longer amber;
  Q2 remove SIMULATED badge; Q3 disabled while disconnected; Q4 one raw sweep; Q5-Q7 as recommended.
- New backend capability → staff-engineer plan (likely ADR + bindings regen).
- PM decisions on plan (2026-11-09): Start resets max/min hold in both modes (existing behaviour);
  single `SessionStatus.captureMode` field; 30 s backend bound for a single capture; live region as designed.
