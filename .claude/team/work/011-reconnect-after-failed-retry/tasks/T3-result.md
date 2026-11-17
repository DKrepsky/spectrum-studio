# 011 T3: BUG-011-QA-1 (acquisition.e2e.ts red with the SA430 attached)

## Root cause

Both failures are in the e2e spec, not in the app. Neither is caused by the 011 change.

1. "pauses ... marked as held": the test read the plot state tag with `toHaveText`, which uses WebKitWebDriver
   `getText`. Since the design-system work (009) the tag is a `Badge` whose text sits in an
   `overflow: hidden; text-overflow: ellipsis` label span, and `getText` returns "" for it. The HOLD text is
   on screen (the screenshot shows "HOLD · last data 02:55:43"). The same assertion ends the single-capture test,
   so that test failed on the tag too.
2. "a single capture takes exactly one sweep": the baseline was read with `frameSeq()`, which reads the status
   bar "Frame #N". That readout is refreshed at most every 500 ms (`useFrameTick(500)` in `StatusBar.tsx`). Right
   after a continuous capture stops it can trail the backend by 4 to 6 frames at 30 fps, so `before + 1` was
   never the single capture's frame (the UI went 84 to 90 or 82 to 86). Backend trace with temporary
   `tracing` in `session/worker.rs` (reverted): every single capture published exactly one frame
   (`complete_single publish` once per `start mode=Single`), and the extra frames were from the continuous
   stream that had just stopped. A later run also failed the "stays Connected for 1.5 s" check (97 instead of 96),
   which is the same readout lag.

Hint checks: the SA430 auto-connect at launch is not the cause. `runSimulator` and `ensureDisconnected` already
release the analyzer before the simulator is used. The app was on the simulator in every run.
The first attempt at the run failed for a different reason, an environment trap: `target/debug/spectrum-studio`
was a plain `cargo` build that loads the dev server (localhost:1420), so every spec failed at launch. Rebuilt
with `npx tauri build --debug --no-bundle`. The selectors still match the UI after 009 (`plot-liveness`,
`frame` readout, `acquire-button`); only the read method changed.

## Fix (e2e only, no app code)

- `e2e/specs/helpers.ts`: `livenessText()` reads `textContent` of `plot-liveness` (the `textOf` pattern the
  file already uses for ellipsised elements). `settledFrameSeq()` waits until the status bar frame number has
  not changed for 1.2 s and returns it, so the baseline is the newest frame.
- `e2e/specs/acquisition.e2e.ts`: the two HOLD assertions use `livenessText()`. The two single-capture tests
  take their baseline with `settledFrameSeq()`.

The fix is in the e2e spec itself; the spec is the regression for these two tests. No app unit test applies,
because no app behaviour changed. The Badge's ellipsis and the 500 ms readout are deliberate UI behaviour and were kept.

## Results

- `SPECTRUM_E2E_SA430=1 npx wdio ... acquisition.e2e.ts` (via `npm run e2e:run`): 3 of 3 runs pass (15 tests each).
- `acquisition.e2e.ts` without `SPECTRUM_E2E_SA430`: 2 of 2 runs pass.
- Full suite `SPECTRUM_E2E_SA430=1 npm run e2e` (builds the debug binary first): exit 0, 11 of 11 spec files,
  115 passing and 1 pending (the "Different device warning" case that needs a second analyzer, skipped by design).
- `npm run check`: exit 0 (cargo fmt, clippy, cargo test workspace, Prettier, ESLint, tsc, Vitest).
  Run log (session scratchpad, not in the repo): `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/ad96e88d-2586-412c-bf1e-8e804b2c848a/scratchpad/check-final.log`.

Before the fix, the same runs failed 2 of 2 in the first pass (HOLD text empty) and 1 of 2 on the frame count
(97 vs 96). A probe that sampled the sequence in 15 ms steps failed 2 of 5 single captures with the old baseline.

Confidence is limited to the sample sizes above. The race is timing-dependent, and no run after the fix failed.

## Flags for the PM

- No product bug was found. The status-bar frame number is a throttled readout by design; the e2e must not treat
  it as an exact per-frame counter. If a real "extra sweep" ever shows up in the backend log, it is a new bug.
- Two wdio runs from another agent (`e2e/specs/t10-shots.e2e.ts`, PIDs 205983 and 208169, started 2026-11-16)
  are still running. They are not mine and were left alone.
- Untouched: all 011 working-tree changes (`src/state/session.ts`, `src/components/source/*`,
  `crates/spectrum-core/src/autoconnect.rs` and tests). Nothing committed.
- Leftover processes from my runs: none (no vite on 1420, no tauri-driver, WebKitWebDriver or app process).
