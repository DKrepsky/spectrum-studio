---
name: e2e-baseline-and-timing
description: How to compare a working tree against HEAD for layout/e2e regressions without git stash, and the transition-timing trap in visual.e2e hover tests
metadata:
  type: reference
---

- Baseline without touching the working tree: `git archive HEAD | tar -x -C <scratch>/qa-baseline`, symlink `node_modules`, then `CARGO_TARGET_DIR=<scratch>/qa-baseline-target npx tauri build --debug --no-bundle` (about 4 min). Copy the binary out before the next build. Run HEAD's own specs from the baseline dir with `SPECTRUM_STUDIO_BINARY=<binary>`.
- Running a working-tree spec against the HEAD binary gives false failures when the spec uses new test ids (for example `acquire-button`). Use the HEAD copy of the spec for comparisons.
- `npm run e2e` needs `PATH` to include the extracted WebKitWebDriver (`/tmp/claude-1000/wkd/x/usr/bin`) and `~/.cargo/bin`. Without it tauri-driver fails with ECONNREFUSED on 4444 for every spec.
- Menu row hover actions (`.source-actions`) slide with a 150 ms `transform`. A box measured right after `moveTo()` can be mid-transition, so the 0.6 px visual guard tolerance passes or fails by timing. Measure the settled state (pause about 400 ms) before calling a regression.
- Keyboard focus: `:focus-visible` on a button reads true after a Tab from a JS `focus()`. A pointer click first can leave it false. Disabling a focused button drops focus to BODY in WebKitGTK.
- The shared config dir in `e2e/wdio.conf.ts` is created once per worker process, so state leakage is per worker, not per spec. A one-off failure of `source-row.e2e.ts` in a full run did not reproduce on rerun.
