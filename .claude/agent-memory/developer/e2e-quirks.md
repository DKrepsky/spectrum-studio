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
