# Review T4 (capture control UI)

Verdict: **approved** (no required changes; follow-ups below are for T5 / QA / optional polish).

Checked against tasks/T4.md, design.md (3-8), story.md, CLAUDE.md; read the code, the dev screenshots
(single capturing 1440, menu open with long name 1024) and ran the component/state Vitest suites (green).

## What matches
- Split button geometry (128/26 px), one outer focus ring via `:has`, tokens `--single*`, no amber stop,
  chevron/main aria-disabled vs native disabled rules, copy table 6 verbatim, roles/aria per section 8,
  menu reuses `useMenuKeys` (Esc/Tab/arrows), menu closes when locked, focus stays on the main button.
- UI reflects `SessionStatus` only: mode from `status.captureMode` (no optimistic change), "single in
  progress" = `acquiring && captureMode === 'single'`; liveness is the one place deciding `capturing`.
- LivenessKind consumers: the only one is `SpectrumView` (badge class `liveness-${kind}` has
  `.liveness-capturing` in app.css; `liveRef` is true only for 'live', so capturing is not drawn as live;
  hint handles 'capturing'). `liveness()`/`useLiveness` callers updated; tests cover capturing never
  stale/live and unchanged behaviour in other states. Nothing else switches on the kind.
- SIMULATED badge, `.badge.simulated`, `--sim`, `.acquire-button` removed with no dangling references in
  `src/`. Simulator stays identifiable through the source button name/aria-label (`Source: <name>, <state>`).
- No device strings in the new code; no hand edits in bindings.

## Notes (not blocking)
1. Stale "cancelled" flag: `cancelled` is set when Cancel is pressed and only cleared when a new capture
   starts. If the stop command fails and the sweep then completes, the live region says "cancelled"
   instead of "complete". Rare; optionally clear it when `busy` returns to null while still capturing.
2. Menu item `aria-describedby`/`aria-labelledby` ids are fixed strings; fine while there is one control.
3. Visual check was Chrome with stubbed IPC; WebKitGTK font width at 1024 (Q8) still needs QA/T5 run.
4. Failure announcement in the live region: being removed by T5 per PM decision (not flagged).

## For T5 (already known)
- e2e: `simulated-badge` assertions in acquisition.e2e.ts (lines 24, 29, 119), sa430.e2e.ts:77 and the
  comment in visual.e2e.ts:550; old aria labels ("Start/Pause acquisition").
- docs/user-guide.md:10 still describes the purple SIMULATED badge; ADR 0005 line 20 says the UI shows a
  SIMULATED badge -> add a note that ADR 0013/006 supersedes it (identity via source name).
