---
name: webdriver-e2e-recipes
description: Working recipe for running the real Spectrum Studio app under WebKitWebDriver from QA, with the wdio/TS pitfalls hit in the 006 capture-mode QA tour
metadata:
  type: reference
---

Run a single spec with a fresh WebKitWebDriver on PATH (no root):
`PATH=<scratch>/webkit/root/usr/bin:$PATH SPECTRUM_E2E_SHOTS=<dir> npx wdio run e2e/wdio.conf.ts --spec e2e/specs/<file>.e2e.ts`
(`--spec` works; `npm run e2e:run` reuses target/debug/spectrum-studio). Long runs: use a background
job and a Monitor until-loop on a log marker, not sleep.

Pitfalls:
- `browser.executeAsync` is not available in this setup; use `browser.execute` and poll a window flag.
- wdio `expect(x, message)` throws "Expect takes at most one argument"; wrap messages in a local helper.
- WebKitGTK `browser.keys(['Space'])` does not press space; use `browser.keys([' '])`.
- Chevron/menus of the capture control are disabled without a connected source: connect first, then
  choose a mode (the helper `chooseMode` fails otherwise with "menu did not open").
- Liveness kind for a held trace is `stopped` (badge text "HOLD"), not `held`.
- The frame counter in the status bar can lag the state by one frame; settle ~1.2 s before taking a
  "before" frame count, and check the count again after a pause.
- After `browser.reloadSession()` the app does not auto-connect; the mode is restored but the source
  must be picked again.
- The SA430 sweep (101 points) can finish before a WebDriver-driven Cancel arrives; use an in-page
  MutationObserver click to cancel within ~30 ms when a cancel-during-sweep is the thing under test.
- Screenshots: `browser.saveScreenshot` works; the window is 1440x900 by `browser.setWindowSize`.
- Do not `rm` files in the work folder (a permission denial halted a step); write new names instead.

Related: [[env-e2e-tooling]] (WebKitWebDriver install and pkill pitfall).

Immediate-cancel repro (006 BUG-1, re-verified 2026-11-09): arm a MutationObserver on the main button
inside one `browser.execute` (see `armClickOnLabel` in `e2e/specs/qa-capture-tour.e2e.ts`) and click
Start; the observer clicks on the label flip. Works on the SA430 (about 70 s for 12 rounds). Good
control: the same loop on a pre-fix build fails with a frame shown after Cancel in most rounds.
