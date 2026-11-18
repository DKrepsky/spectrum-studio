---
name: app-autoconnect-and-probe-setup
description: The app auto-connects a detected SA430 at launch (seeded last-used source); how to build a QA binary without touching the dev binary; probe spec pattern and cascade trap seen in work 013
metadata:
  type: reference
---

- The app auto-connects a detected SA430 at launch (`spectrum_core::autoconnect`). With the visual seed (`vis-real`, the latest `lastUsedMs`) the probe app showed the real SA430 "Connected" without any click. Expect that when a real device is attached; it also means a second instance grabs the port.
- Build a QA binary into a separate target dir so a running dev instance's `target/debug/spectrum-studio` is not overwritten: `CARGO_TARGET_DIR=<scratchpad>/qa-target npx tauri build --debug --no-bundle`, then `SPECTRUM_STUDIO_BINARY=<that binary>` for `npx wdio run e2e/wdio.conf.ts --spec ...`. A full build from cold is about 3.5 min.
- Probe specs: a throwaway `e2e/specs/<basename>.e2e.ts` gets its seed from `e2e/fixtures/seed/<basename>/` (copy `visual/`). Delete both afterwards. `console.log` lines appear in the wdio log prefixed by the worker id.
- Cascade trap: when one step in a probe fails (for example a menu item not found), its open popover stays open and the next clicks fail with "element click intercepted". Close menus with Escape and re-check state at the start of each `it`.
- Chevron of the capture control is native-disabled with no source connected, so `[role=menu]` never exists there. That is expected (DESIGN 4.3), not a defect.
- Simulated zoom works with `document.documentElement.style.zoom` (see [[webview-zoom-simulation]]). Measure the popover and menu boxes, not only the trigger, because absolutely positioned menus extend the scroll box.

Related: [[webview-zoom-simulation]], [[webdriver-probe-pitfalls-012]], [[e2e-baseline-and-timing]]
