---
id: 0045
from: developer
to: staff-engineer
type: handoff
subject: T14 done: source button, menu, glyphs, fixed widths
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:21:28-03:00
---

T14 implemented, uncommitted in the working tree.

Files: src/components/source/{SourceMenu.tsx,SourceButton.tsx,status.tsx,useMenuKeys.ts}; new src/styles/source.css (menu/button rules moved out of app.css, imported in src/main.tsx after app.css); tests SourceMenu.test.tsx (reworked, 46 tests), new SourceButton.test.tsx, new src/styles/source.css.test.ts. Toolbar/NoticeBanner/App needed no change.

Behaviour: CSS-drawn .src-dot[data-status] glyphs (button has none when no active source); rows are grid 18px|1fr|64px with always-rendered line 2, .src-badge in column 3, actions absolutely placed in column 3 (visibility:hidden, so they stay in the DOM and focusable via focus-within); inline rename removed; pencil/F2 open SourceDialog {mode:'edit'|'edit-detected'}; detected rows have pencil only; Add source... replaces Other sources... (view 'other' removed); menu is hidden (not unmounted) while the dialog is open and scanning stops; saved -> menu re-opens, row focused + data-highlight 3 s; forgotten -> Undo toast; cancel -> menu closes, focus to the source button. SourceDialog stub types unchanged.

Checks: eslint src, prettier --check src, tsc --noEmit, vitest run: all green (22 files, 198 tests, includes T15's dialog tests at the time I ran). Did not run cargo/npm run check/e2e.

Screenshots viewed (real Chrome headless against vite with the real components and a stubbed Tauri IPC; harness deleted): 1180 wide, 1024 wide with a failed row, 500 wide, a detected-new row, and the idle "Choose a source" button. They match prototype 05/05b/10/15/16/24: name edges identical for the 22 and 60 char names and file row, 64px badges, line 2 under the name, actions bottom-right in the badge column. Probe: badge widths all 64; every row's name right edge identical; the row's child rects identical before and after focusing it (actions go hidden->visible, no movement).

Deviations / concerns:
1. Fixed "Signal simulator" item is single-line (30px, no line 2) like the prototype; the task's test list says line 2 even there. Tests assert glyph + badge there, line 2 for real rows only.
2. Cancel closes the menu (task item 4 + prototype) rather than returning to the list; my stub-Escape test asserts that.
3. "Detected devices" heading is now always shown with the design text "No new devices found. ..." (was "No devices found" and conditional). Test copy updated; e2e may reference the old text.
4. e2e/specs/{persistence.e2e.ts,helpers.ts} still use source-rename/source-rename-input (T16). docs mention rename too.
5. SourceForm's noDeviceHint is effectively unreachable now (form opens only from a detected row or a file); left unchanged, its test removed.
6. Not verified in the real built app (T12 backend in flight); pixel check was via the harness only. Reduced-motion/animation not visually checked.
