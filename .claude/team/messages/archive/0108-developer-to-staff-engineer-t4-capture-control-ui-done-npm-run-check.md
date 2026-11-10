---
id: 0108
from: developer
to: staff-engineer
type: handoff
subject: T4 capture control UI done, npm run check green, screenshots in work/screenshots
work: 006-capture-modes
reply-to: 0106
date: 2026-11-09T21:39:35-03:00
---

T4 (capture control UI) implemented per tasks/T4.md, design.md and prototype. Uncommitted. `npm run check` EXIT 0 (rust fmt/clippy/183 tests, eslint, tsc app+e2e, Vitest 246 passed).

Files
- New: src/components/capture/CaptureControl.tsx (split button, live region, state logic), src/components/capture/CaptureModeMenu.tsx (radio menu, reuses source/useMenuKeys), src/styles/capture.css (+ capture.css.test.ts for fixed 128/26 px, one focus ring, tokens, no amber stop, no SIMULATED).
- Tests: src/components/capture/CaptureControl.test.tsx (40 incl. Toolbar: names/titles per state, busy/locked/disabled, menu keys, Esc/Tab/outside click, close on lock, live region complete/cancelled/failed, no announcement for continuous, focus kept on the main button across start/stop).
- Edit: src/components/Toolbar.tsx (uses CaptureControl, SIMULATED badge removed, Play icon code gone), Toolbar.test.tsx, src/components/SpectrumView.tsx (mode-aware empty hints, "Capturing one sweep…"), src/components/StatusBar.tsx (+test: mode-aware no-data copy), src/styles/app.css (tokens --single/--single-strong/--single-ink, .liveness-capturing, removed .primary.stop and .badge.simulated and .acquire-button, plot-hint centred), src/main.tsx (imports capture.css).
- Not touched: T2 Rust, src/bindings (no regeneration needed), docs, e2e specs.

Behaviour notes
- Main button: testid acquire-button kept, plus data-mode and data-state. Chevron testid capture-mode-button, menu capture-mode-menu, live region capture-live-region.
- Mode shown from status.captureMode only (no optimistic change). Single in progress = acquiring && captureMode === 'single'.
- "Cancelled" vs "complete" is decided in the UI: a Stop pressed during a single capture is remembered locally; the backend end state decides the rest. Failure comes from lastNotice acquisitionFailed.
- Menu closes without a mode change when the control becomes locked (acquisition started elsewhere, a command began); focus returns to the chevron if the focused item was removed.

Visual check (no WebDriver on this machine, so Chrome with a stubbed Tauri IPC, not the real binary)
- Screenshots in .claude/team/work/006-capture-modes/screenshots/dev-*.png: 1440 continuous idle, single idle, single capturing, menu open, disabled no source, focus ring on chevron and on main (real Tab keys); 1024 continuous acquiring, single capturing with long name (ellipsis, no overflow), menu open with long name.
- Not verified: WebKitGTK real font width (Q8), real device, the e2e run.

Open items for you
- e2e specs still reference the removed SIMULATED badge and old aria labels: e2e/specs/acquisition.e2e.ts (lines ~24, 29, 81, 91, 119), sa430.e2e.ts:77. Typecheck passes; behaviour specs will fail until T5 updates them. Left for T5 as instructed.
- Failure is announced both by the live region and the existing role=alert notice, so a screen reader may say it twice. Kept because the task asks for failure in the live region; say if you want it removed.
- Plot hint and status bar copy now depend on mode and state; no spec covers SpectrumView hints directly (App.test covers the no-source hint).
- Developer memory added: .claude/team/.claude/agent-memory/developer/visual-check-without-webdriver.md.
