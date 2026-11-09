---
name: webkit-e2e-recipes
description: Working recipe to run WDIO specs against the Tauri debug build in WebKitGTK here (WebKitWebDriver PATH, window min width, hover/focus quirks, reduced motion not emulated)
metadata:
  type: reference
---

- Build: `npx tauri build --debug --no-bundle` (the frontend is rebuilt by beforeBuildCommand; CSS changes need this).
- Run one spec: put the extracted WebKitWebDriver dir on PATH (`apt-get download webkit2gtk-driver` + `dpkg-deb -x`, see env-e2e-tooling memory) and `$HOME/.cargo/bin`, then `npx wdio run e2e/wdio.conf.ts --spec e2e/specs/<x>.e2e.ts`. Set `SPECTRUM_E2E_SHOTS=<dir>` for screenshots (`shot('name-{w}-data')`).
- Window minimum is 1024px (`src-tauri/tauri.conf.json`); `setWindowSize(520,…)` clamps to 1024.
- Real SA430 (TI, 2047:0005) on /dev/ttyACM0 is detected without a seed (use a spec with no seed dir).
- `prefers-reduced-motion` does not follow GNOME `enable-animations` in WebKitGTK (matchMedia stays false); it cannot be exercised in the app.
- WebDriver screenshots are taken after the pointer moved; `moveTo` on an element hovers it. Take the screenshot before moving the pointer away.
- Focus: an element with `visibility:hidden` cannot be focused (`.focus()` is silently ignored), so keyboard routes into hidden buttons fail.
- `:has()` and `:focus-within` work in this WebKitGTK (CSS.supports true).
- Mid-transition frames are not catchable through WebDriver round-trips; use `transitionstart` listeners and computed `transition` values.
- Hover-then-focus flakiness: a hover/focus step in one spec failed in 2 of 5 runs without a root cause; re-run before blaming the product.
