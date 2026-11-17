---
name: prototype-method
description: How to build, measure, screenshot and check the single-file HTML prototype and the measurement harness that use the app's real CSS on this machine (template, hash switches, getBoundingClientRect via --dump-dom, headless flags, traps)
metadata:
  type: reference
---

Verified on this machine (google-chrome 157 at /usr/bin/google-chrome, Python 3 with PIL and numpy). Used for work 009.

- **Real CSS, not a copy.** Build the prototype with a small Python script that reads `src/styles/*.css`. Proposed fixes go under a `.v-new` scope, so current and proposed sit side by side with the same markup. (In work 009 the prototype was edited in place with Python `str.replace` and assertions; the build script was not kept.)
- **Measurement harness** (kept in `.claude/team/work/009-design-system/measure/build_harness.py`): builds a page with the toolbar, status bar and side panel and the real CSS; puts the boxes in `<pre id="out">`. Run `--dump-dom` at a window width and parse the JSON. Use it for widths, overlaps and targets.
- **Read back, do not type.** Fill `data-out-*` cells from `getBoundingClientRect` and `getComputedStyle`; read them with `--dump-dom` and a regex. A `measure error` string can appear in the dump because the script's own source contains it: check for a real error by reading the cell.
- **Headless screenshot:** `google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=W,H --screenshot=<abs png> "file://<abs html>#view=..."`. For a tall page, use a tall window and crop with PIL. Find card offsets first: a small script that writes `section.fix` offsets into a `<pre>`.
- **Viewport is not the frame:** media queries follow the window. Use `--window-size` to test a width; a CSS-only frame needs a class mirror.
- **Forced states:** `:hover` and `:focus-visible` cannot be triggered from a dump. Mirror them under `.st-hover` and `.st-focus`.
- **Traps hit:** a `const` shadowing a module-level `let` blanked a view (check `--dump-dom` for an empty `<main>` after every JS edit); absolute popovers nested in a gallery cell collapse to zero height; half-width panes clip toolbars.
- **Fonts here:** Inter and JetBrains Mono are missing; Ubuntu and DejaVu Sans Mono are installed. Real WebKitGTK widths differ; note it in the design.
- **Tool note:** the Edit tool refuses to edit a file that the bash side changed after the last Read; use Python for bulk edits and Read first when an Edit is needed.

**Why:** the measured numbers are the evidence for fixes; they must come from the real CSS, not from memory.
**How to apply:** rebuild the harness at the widths in question, read the JSON, and quote the numbers with "measured, fallback fonts".

Related: [[design-conventions]]
