---
id: 0078
from: developer
to: product-manager
type: handoff
subject: 003 fix round 1: BUG-1..4 fixed, npm run check green, e2e green except known defect
work: 003
reply-to: 
date: 2026-11-09T00:17:18-03:00
---

Fix round 1 for 003 (uncommitted, working tree). Bugs 0069, 0071, 0073, 0075 archived.

Fixed
- BUG-1 (focus): Play/Pause uses `aria-disabled="true"` while a command is in flight (busy) instead of
  `disabled`; clicks are ignored in `toggleAcquisition` while busy. Native `disabled` only when not ready
  (disconnected, connecting, disconnecting). `src/components/Toolbar.tsx`.
- BUG-2 (copy): "No data yet — press Play to start acquisition." `src/components/StatusBar.tsx`.
- BUG-3 (hover): `button.primary.stop:hover` keeps amber (`--warn-strong: #f0a22e`); the teal hover rule now
  excludes `[aria-disabled='true']`. `src/styles/app.css`.
- BUG-4 (overhang): `.source-actions { right: 9px }` (1 px border + 8 px padding). `src/styles/source.css`.
  Visual guard: the hover/focus assertions now wait until the 150 ms slide has ended (`transform: none`, no
  running animation) before measuring (`waitForActionsSettled`, `e2e/specs/visual.e2e.ts`). TOL unchanged (0.6).
  The 1024 and 520 hover failures had the same cause: they are green now.

Tests added or changed
- `src/components/Toolbar.test.tsx`: busy marks Play aria-disabled and stays enabled; new test: focus kept on
  Play while busy (Enter, then click and Space ignored, no second start), focus and enabled state after the command ends.
- `src/components/StatusBar.test.tsx` (new): Play copy when connected without data; "No source connected." when none.
- `e2e/specs/acquisition.e2e.ts`: "keeps keyboard focus on Play/Pause across Space and Enter presses" (Space, Enter,
  Space, Enter; focus stays on acquire-button each time).

Check results
- `npm run check`: EXIT 0. cargo fmt, clippy -D warnings, cargo test (94 + 8 + 16 + 13 + 14 + 8 passed, 0 failed, ignored
  as before), prettier, eslint, tsc, vitest 23 files / 204 tests passed.
- `PATH=/tmp/claude-1000/wkd/x/usr/bin:$PATH npm run e2e`: EXIT 1. 9 spec files green, including the new keyboard
  test. visual.e2e.ts: 21 passing, 3 skipped (describeHardware and the mismatch stub), 1 failing:
  "hover actions sit below the badge pill instead of covering it" (the documented known defect; fails on its own
  assertion: actions top 176.5 vs badge bottom 195). Nothing else fails.

Deviations and notes
- Added `.claude/team/work/**/evidence/` to `.prettierignore` and to the `eslint.config.js` ignores. QA's evidence
  folder (JSON and a TS file) failed prettier and eslint, so `npm run check` could not go green otherwise. Revert
  if QA prefers to keep evidence elsewhere.
- Not verified: the hovered-Pause amber in a screenshot and the status bar text in a fresh screenshot (no new
  screenshots taken); the CSS and unit tests cover them. Visible native tooltips are still not captured.
- Known defect left as is, per the brief (separate from BUG-4).

Files: src/components/{Toolbar,StatusBar}.tsx, src/components/{Toolbar,StatusBar}.test.tsx, src/styles/{app,source}.css,
e2e/specs/{visual,acquisition}.e2e.ts, .prettierignore, eslint.config.js. Developer memory: e2e-quirks.md updated.
