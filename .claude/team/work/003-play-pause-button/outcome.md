# 003 Outcome — accepted 2026-11-09
Human: "Accept and commit".

| Criterion | Result | Evidence |
| --- | --- | --- |
| State pill removed, SIMULATED kept | Pass | qa.md R1 AC1, screenshots/connected-1180-sim.png |
| Icon-only Play/Pause in place of Run/Stop | Pass | toolbar-compare.png |
| Play starts; Pause icon only on backend `acquiring` | Pass | e2e acquisition; real SA430 r2-real-acquiring-1180.png |
| Pause freezes trace (HOLD), Play resumes | Pass | r2-real-paused-hold-1180.png, paused-1024 |
| Disabled when not connected; no auto-connect | Pass | r2-disconnected-*.png, unit tests |
| A11y: labels, tooltip attrs, focus ring, Space/Enter, focus kept | Pass (native tooltip not screenshot-able) | r2-kbd-*.png, e2e keyboard spec |
| Tests updated, check green | Pass | PM ran `npm run check` (exit 0); e2e green except documented known defect |

Fixed during QA: focus loss after keyboard toggle (inherited), "press Run" copy, Pause hover colour,
pre-existing 1px source-menu action overhang. Decisions: Pause = stop acquisition; `run()` auto-connect removed.
Remaining: known defect "hover actions sit below the badge pill" (roadmap). ~0.7 s frame tail after Pause on SA430 (sweep not interruptible; expected).
