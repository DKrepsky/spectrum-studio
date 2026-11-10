---
id: 0131
from: developer
to: product-manager
type: handoff
subject: 006 accepted adjustments done: menu footer, red Stop, qa spec removed
work: 006-capture-modes
reply-to: 
date: 2026-11-09T23:39:10-03:00
---

Done. Nothing committed. Summary of the three adjustments:

1. Mode menu: footer text and its separator removed (`CaptureModeMenu.tsx`, `capture.css` `.mode-foot` gone). No gap left at the bottom; the popover's 6px padding is the only bottom space.

2. Capture control red while acquiring
- `src/styles/app.css`: reuse `--danger: #ff6b6b`; added `--danger-strong: #f04848` (hover) and `--danger-ink: #120a24` (label/icon).
- Contrast: ink on `--danger` 6.91:1 (AA), ink on hover `--danger-strong` 5.23:1 (AA).
- `CaptureControl.tsx`: container `.capture` gets `data-state` (acquiring|idle); main button keeps its own `data-state`.
- `capture.css`: `.capture[data-state='acquiring']` sets both segments red, chevron border-left dark, hover red-strong. Placed after the mode rules; geometry untouched (no width/height in that block).
- Locked chevron keeps the existing `opacity: 0.55` lock affordance. Its icon is about 2.9:1 on the red, which is a disabled-state control, so WCAG 1.4.11 does not apply; flagging it since you asked for AA.
- Idle colours unchanged (teal/purple).
- Tests: `capture.css.test.ts` (tokens, red rule, hover, no geometry override, no mode-foot); `CaptureControl.test.tsx` (footer absent, data-state on container for acquiring/idle). Vitest for capture folder: 45 pass.

3. QA spec removed: `e2e/specs/qa-capture-tour.e2e.ts` and `e2e/fixtures/seed/qa-capture-tour/` deleted. No references in helpers, docs/testing.md or specs. Left alone: historical QA/PM notes, and `.claude/agent-memory/qa/webdriver-e2e-recipes.md` (QA's memory still names the file; QA should update it).

Docs: `docs/user-guide.md` now says the button turns red while acquiring (Pause or Stop). design.md untouched.

Checks
- `npm run check`: exit 0 (format, lint, tsc app+e2e, Vitest 263 pass, Rust fmt/clippy/tests).
- `npm run e2e` (rebuilt debug binary, WebKitWebDriver from scratchpad): 13 + 6 + 4 + 3 + 3 + 3 + 5 + 10 + 19 pass; 2 acquisition + 4 visual fail.
  - visual: the 4 known pre-existing failures (hover actions below pill; source button 150-280px at 520/1024/1180).
  - acquisition: "single capture takes exactly one sweep" and "cannot change the mode while acquiring" failed in the full run. Re-run alone: `acquisition.e2e.ts` 15/15 pass. Looks like timing flakiness on a cold first spec; I did not find a code cause (no behaviour changed). Worth a QA re-run.
  - Log: `scratchpad/e2e.log` under /tmp/claude-1000/-home-kr-workspace-spectrum-kit/a640f3fc-2223-4a00-85a4-79b77b8f32a1/scratchpad/e2e.log

Screenshots at 1440 (`.claude/team/work/006-capture-modes/screenshots/`), all viewed:
- final-continuous-acquiring-1440.png: red Pause, real simulator.
- final-continuous-idle-1440.png: teal Play, real simulator.
- final-menu-open-1440.png: menu with no footer, real simulator.
- final-single-idle-1440.png: purple Play, real simulator.
- final-single-capturing-1440.png: red Stop, MOCKED. The SA430 on /dev/ttyACM0 is held by your running app (pid 145233, fd 52; e2e log says "Device or resource busy"), so I did not open it a second time. The simulator sweep is too short to screenshot. The mocked status was delivered through the app's own session-status event (revision newer), so the rest of the UI is real.

Process: did not touch pid 145233. Temporary screenshot spec was deleted after use.
