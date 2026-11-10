---
name: design-conventions
description: Toolbar and control conventions of Spectrum Studio (tokens, 30px control height, fixed-width segments, focus ring rules, amber/purple usage, popover pattern) as observed in src/styles
metadata:
  type: project
---

Observed in `src/styles/app.css` and `source.css` (re-check before relying on a value; they change).

- Colour tokens: accent teal `#3ee0b5` (connected, primary action), warn amber `#ffb547` (waiting/stale and the old Stop/Pause), danger `#ff6b6b`, info blue `#5aa9ff` (focus ring), `--sim` lavender `#c39bff` (SIMULATED badge only).
- Toolbar control height is `--control-height: 30px`. Every toolbar control matches it. Square icon buttons are 30px.
- Fixed-width widgets keep layout stable (for example the 150px freq input, 280px source max). Prefer fixed widths over content-driven widths for anything that changes label.
- Focus ring: `outline: 2px solid var(--info); outline-offset: 1px` on buttons/inputs. For composite controls, one ring around the group via `:has(:focus-visible)` (source.css already uses `:has`). A per-segment ring on a coloured neighbour fails contrast.
- Popovers: `surface-2` background, `1px var(--border)`, radius 8px, shadow `0 12px 36px rgba(0,0,0,.5)`, `z-index: 20`, `top: calc(100% + 4px)`. Items use `.source-item` rhythm (7px/8px padding, radius 6px, `surface-3` on hover and focus).
- Keyboard model for menus: roving focus, Up/Down with wrap, Home/End, Esc and Tab close (focus back to the trigger), type-ahead, Enter/Space activate. Implemented in `src/components/source/useMenuKeys.ts`.
- Plot badges: `.plot-badge` with `.liveness-live` (teal), `.liveness-waiting` / `.liveness-stale` (amber), grey HOLD text. Copy: `LIVE`, `Waiting for data…`, `No data for N s`, `HOLD · last data hh:mm:ss`.
- Chrome: the status bar shows `Unit dBFS` and `Uncalibrated` (amber). Never label uncalibrated data dBm.
- The 1024px minimum window is the binding width. At `max-width: 1180px` the toolbar gap is 10px and the freq input is 128px.

Proposed (pending human decision in 006-capture-modes Q1): colour carries mode only (teal continuous, purple single). Amber is then reserved for warnings, not for "Pause". Running is shown by the icon and the badge.

Related: [[prototype-method]]
