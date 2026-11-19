---
name: e2e-quirks
description: How to run and write the WebdriverIO e2e specs here (WebKitWebDriver PATH, seeds, window clamp, hardware status values, expect messages)
metadata:
  type: project
---

- WebKitWebDriver is not installed system-wide: put an extracted copy on PATH (`apt-get download webkit2gtk-driver` + `dpkg-deb -x`, then `PATH=<dir>/usr/bin:$PATH npm run e2e`). Never `pkill -f`.
- Seeds: `e2e/fixtures/seed/<spec name minus .e2e.ts / .ts>/` (also used by `e2e/tools/screenshot.ts`); write `version: 3` seeds.
- The Tauri window has minWidth 1024: `browser.setWindowSize(520, ...)` is clamped to 1024; name screenshots with the real `innerWidth` (`shot('x-{w}-y')`).
- wdio's `expect` takes no message argument; `e2e/specs/visual.e2e.ts` wraps it. WebKit `getText` is empty for ellipsised spans: use `textOf`.
- Row hover actions are `opacity:0; pointer-events:none` (still focusable, so ArrowRight reaches them): use `revealRowActions` (hover, then focus fallback) before clicking `source-edit`/`source-forget`. Do not reintroduce `visibility:hidden`: it removes the buttons from focus and breaks ArrowLeft/Right (QA 002 BUG-1).
- Real SA430 snaps the centre to its step (434.5M shows as 434.499): match `/Center 434\.[45]/`.
- `SPECTRUM_E2E_SHOTS=<dir>` redirects screenshots; guard proof = temporarily revert `64px` in `src/styles/source.css`, `npx tauri build --debug --no-bundle`, run visual spec.
- Row hover actions slide for 150 ms: before measuring their box, wait until `transform` is `none` and `getAnimations()` is empty (`waitForActionsSettled` in `visual.e2e.ts`). Focusing only the row item does not reveal them (`:focus-within` is on the actions), so do not wait there.
- Busy Play/Pause uses `aria-disabled`, not `disabled`: a natively disabled button drops keyboard focus to BODY in WebKit. Keep `disabled` only for the real not-ready state.
- `.prettierignore` and `eslint.config.js` exclude `.claude/team/work/**/evidence/` (QA evidence is not product code).

## Added in T7 (BUG-1)
- wdio 10 has no `browser.executeAsync`; for in-page async work, arm a MutationObserver or timer in
  `browser.execute`, write the outcome to `document.body.dataset`, and poll it with `waitUntil`.
- `expect(actual, message)` is not allowed by the wdio expect typings: use `if (...) throw new Error(...)`
  for messages with round numbers.
- `getText()` on the visually-hidden live region returned "" while `textContent` had the text: read
  `textContent` through `browser.execute` for `.visually-hidden` elements.
- Pre-fix check recipe: back up the fixed sources, reintroduce the old code, `npx tauri build --debug
  --no-bundle` (a TS unused-local error makes the build fail and wdio silently runs the OLD binary, so
  check the build EXIT line first), run the spec, restore the backup, rebuild.

## Added in 006 adjustments (screenshots)
- The debug binary embeds the frontend: run `npx tauri build --debug --no-bundle` before screenshots, or they show the old UI (the wdio run still passes).
- A throwaway spec works with `--spec <absolute path>` when it lives inside the repo (module resolution for `@wdio/globals`); delete it afterwards.
- A status can be injected for a mocked state: `window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {event:'session-status', payload})` with a revision newer than the last one. Read the real status with `invoke('get_status')` into `document.body.dataset` and poll (no executeAsync).
- A running human instance holding `/dev/ttyACM0` makes the SA430 "Device or resource busy" for any other instance; do not open it again.

## Added in T0 (009 baseline shots)
- Injected statuses (`plugin:event|emit` of `session-status`, revision far above the backend's) are
  shown, but ANY injected status with a source clears the frame store (the UI reads it as a source
  switch in `receiveStatus`), and the backend's later statuses are then dropped as out of order.
  So inject last, and only use injection for states without a frame (waiting, capturing, banners,
  connecting). A stale plot tag is not reachable with the simulator.
- `console.log` inside `browser.execute` does not reach the wdio log: return the value and log it
  in Node.
- A failed connect is still `Connecting…` for a moment: call `waitForLaunchSettled()` before the
  next pick, or the next click lands on the wrong row (this made the source-button width test red).
- Run one spec with `--spec <abs path>` and `--mochaOpts.grep "<test name fragment>"`; the grep
  must match the full `it` title, not a shortened phrase.
- `visual.e2e.ts` on main has one red test by design (the known hover-actions defect); the rest pass.

## Added in T1 (009 token foundation)
- Before/after of a change that is CSS-only: a computed-style probe (`getComputedStyle` on the hovered
  element, written as JSON) is more reliable than screenshots. Live shots differ between runs (peak
  rows, frame counter, the plot cursor where the pointer rests, pulsing dots). Compare toolbar and
  static panels by pixel, and use the probe for hover states.
- Which build is running: `getPropertyValue('--color-surface-panel')` on `documentElement` is empty on
  pre-token builds and `#121a26` after T1. Check it before trusting a "before" run.
- Pre-change binary without touching the main tree: `git worktree add --detach <scratch> HEAD`,
  symlink `node_modules`, `CARGO_TARGET_DIR=<main target> npx tauri build --debug --no-bundle` (about
  15 s incremental), copy the binary out, then rebuild the main tree before the next run.
- Red on HEAD in this environment (not caused by token work): source-row "ArrowRight ... Edit is not
  focus-within its row" (`:focus-within` on the actions is false here) and acquisition "a single capture
  takes exactly one sweep" (about 1 in 2 runs). Re-run both before blaming a change.
- Layered control rules: an unlayered class rule now beats a `button:hover` rule regardless of
  specificity. Hover borders that came from the global rule must be restated in the class file
  (source.css `.source-item:hover`); check with the computed-style probe.

## Added in 009 T2 (canvas pixel check)
- Live canvas shots cannot be compared pixel for pixel: the "no source" and "hold" shots still show
  simulator data (the injected status did not replace it). Use the `statusbar-connecting-*` shots
  (no frame, plot drawn as background, grid and axis only) for an exact canvas check; their plot
  region is byte-identical before and after a canvas-colour change. Check trace colours by exact
  pixel count (e.g. peak `#ffd166` in hold shots) only as a presence check.
- Driver for a Debian-only setup: `apt-get download webkit2gtk-driver` into the scratchpad, then
  `dpkg-deb -x` into a fresh dir and put `<dir>/usr/bin` first on PATH (the copy in the scratchpad
  `wkd` folder was empty).

## Added in 009 T6 (parallel runs)
- "Maximum number of active sessions" from wdio means another tauri-driver run holds port 4444 (another
  agent's e2e). Check `ps -eo pid,etime,args | grep -E "tauri-driver|WebKitWebDriver"`, wait for that run to
  exit, then retry. Never kill it: it is not yours.
- A ui `Button`/`IconButton` with `unavailable` still reports `isEnabled` true to wdio: a spec that waits for
  `waitForEnabled` then clicks needs native `disabled` (peak-search does this).

## Added in 009 T7 finish (geometry and shots)
- `pgrep -f "e2e/wdio.conf.ts"` matches the shell that runs the check itself, so a wait loop never ends. Use `pgrep -f "[w]dio.conf"`.
- A `run_in_background` e2e can report "completed" while wdio still runs. Read the log's `Spec Files` line before trusting it.
- Screenshots of `:focus-visible` rings are only drawn when the WebDriver window has OS focus. Check `document.hasFocus()`;
  `wmctrl -a "Spectrum Studio"` from the spec (execSync) gives focus, and then the ring shows as in the before shots.
- Full-run flakes that pass alone (persistence "stale element", "the row actions did not appear" in the visual spec):
  re-run the single spec or `--mochaOpts.grep` before blaming a change.
- Reusing a visual-spec seed for a throwaway probe: copy `e2e/fixtures/seed/visual` to `seed/<probe name>`, and delete both after.

## Added in 009 T9 (popover finish)
- Full-run flakes seen in one session, each passing alone: "stale element" on `waitForExist({ reverse: true })` of the dialog right after Save (edit-source, migration-dup); the single-capture "exactly one frame" (acquisition); and the ArrowRight focus-within check (source-row). Re-run each alone before reporting it as red.
- Keyboard-focus shots: the pointer is still over the row that was just clicked (Undo or Forget), so that row shows its hover actions mid-transition over its badge. Park the pointer before shooting focus states.
- A `measure/` or `evidence/` folder of QA/designer HTML is not product code: `.prettierignore` covers `.claude/team/work/**/measure/` too. Prettier only on the spec file you edited.

## Added in 009 T9 polish (stale elements, focus, before geometry)
- `waitForExist({ reverse: true })` on a dialog or menu that unmounts during the wait can fail with
  "Stale element found when trying to create the node handle" (WebKitWebDriver race). It also happened on
  HEAD (edit-source "forgets from the dialog", run 1 of 3). Use `waitForGone(testId)` (helpers.ts): the
  check runs in the page, no node handle.
- `:focus-within` and `:focus` match only while the page has OS focus (`document.hasFocus()` false otherwise).
  HEAD fails the ArrowRight focus-within check in 3 of 4 runs for that reason. `ensureWindowFocus()` raises
  the window with `wmctrl -a "Spectrum Studio"` only when needed. Note: `wmctrl -a` on an already focused
  window flips `hasFocus` to false first, so never call it unconditionally.
- After a focus change, the row actions take 150 ms to reach opacity 1: `getComputedStyle` read at once
  says 0. Wait for the reveal (`waitUntil`) before asserting.
- Before geometry for the popover: the HEAD worktree (`git worktree add --detach <scratch>/head HEAD`,
  `CARGO_TARGET_DIR=<scratch>/head-target`, run wdio there with `SPECTRUM_STUDIO_BINARY`) gives the "before"
  look. Before: row box 47px and pitch 47px (rows touch, the 47px box is the old inline-button layout);
  now the box is 44px and a 3px `--row-gap` gives the same pitch.
- Each `.list-row` sits in its own `<li>`: "consecutive rows of one list" means `closest('ul')`, not `parentElement`.
- A real SA430 on /dev/ttyACM0 is auto-connected by every e2e launch (ADR 0014): seeded rows can change
  state under the test. Do not assume an unplugged device.

## Human uses the desktop during e2e (2026-11-16)
The e2e app runs on the human's live desktop. If they switch windows, the app loses OS focus: focus-within reveals
fail and non-modal popovers close on focusout. Treat isolated focus-related reds as suspect before root-causing;
re-run unattended (or ask the PM to ask the human) before chasing them.

## Added in 009 T11 finish (row-action click flake)
- "connected and acquiring with a 22-char name" (visual, full run only, 3 reds in the history): the hover actions
  were revealed by `moveTo(row)`, then clicked later with no pointer move. If the list moved under the stationary
  pointer, the actions go `opacity:0`/`pointer-events:none`; WebDriver reports "element not interactable" and
  wdio's `waitForClickable` never recovers (it does not move the pointer). Reproduced on purpose (list shifted by
  60px after the reveal): the old path fails, a re-hover right before the click passes. `moveTo` onto a hidden action
  itself fails, so the row must be hovered first.
- Use `clickRowAction(entryTestId, 'source-edit' | 'source-forget')` (helpers.ts) for row actions, never
  `revealRowActions(...).$(...).click()`.
- The trigger inside the full run was not captured (1 red in the last 3 full visual runs; a full visual run passed).

## Added in 011 T3 (acquisition red with the SA430 attached)
- `npm run e2e:run` reuses target/debug/spectrum-studio. A binary from a plain `cargo build` loads the dev server
  (localhost:1420): every spec fails at launch with "the application did not finish loading" and the page reads
  "Could not connect to localhost". Rebuild with `npx tauri build --debug --no-bundle` first, or use `npm run e2e`.
- The plot state tag (`plot-liveness`) is a `Badge`: its text sits in an ellipsised label span, so `toHaveText`
  (getText) is empty. Read it with `livenessText()` (textContent).
- The status bar "Frame #N" is refreshed at most every 500 ms (`useFrameTick(500)`). Right after a continuous
  capture stops it can trail the backend by 4 to 6 frames, so a `before + 1` check on it is wrong. Use
  `settledFrameSeq()` for the baseline. The backend publishes exactly one frame per single capture (checked with
  temporary `tracing` in `session/worker.rs`, reverted).

## Added in 012 fix pass (focus after Enter)
- A commit that sets a global busy state disables its own field, and WebKit drops focus to BODY, even with the blur removed. Check `document.activeElement` after the commit in the real app. The fix used: `readOnly` while busy (DESIGN 4.4 read-only), not `disabled`. Span (a native select) still has this issue; not fixed in 012.
- Probe recipe that worked: a throwaway `e2e/specs/<name>.e2e.ts` run with `npm run e2e:run -- --spec <abs path>`, `console.log('PROBE ...')` from the spec, read the log, delete the spec. Do not run `npx wdio` by hand.

## Added in 015 T5 (launch state with the simulator fallback)
- The app launches with the simulator connected when no analyzer is attached (ADR 0017), and with the
  analyzer when one is plugged in: this machine always has the SA430, so no-device launch assertions
  use `analyzerAtLaunch()` and go pending (`this.skip()`, needs a `function` callback). Do not weaken
  them to pass with the analyzer.
- Disconnect keeps the selection; the plot hint "Not connected…" only shows with no trace on screen
  (a trace keeps HOLD). Connecting clears the trace, so check the hint after a connect + disconnect.
- A visually hidden description (`.visually-hidden`) is clipped by design: `findOverflow` skips it.
  Without that skip a help description read as overflow and cascaded (the open menu was intercepted
  in later visual tests).
- Busy-port test: a python3 helper holds `/dev/ttyACM0` with TIOCEXCL (`holdPort` in sa430 spec);
  the serial open then fails and the row must read Failed.
- Persistence spec seeds a named simulator preset ("Bench FM setup"): an unnamed simulator is never
  listed under Your sources, so rename/forget need a named entry.
