---
name: webview-zoom-simulation
description: Ctrl+= does not zoom the Spectrum Studio webview in this build; how to simulate text enlargement (150%, 200%) by root CSS zoom and what the simulation does not cover
metadata:
  type: reference
---

- Ctrl+=, Ctrl+Shift+= and Ctrl+0 (WebDriver `browser.keys`) leave `window.innerWidth` at 1024 (checked 2026-11-18, work 012 round 2). The webview does not zoom from the keyboard in this build.
- Simulation that works: `document.documentElement.style.zoom = '1.5'` at a 1024 px window. The layout viewport becomes 1024 / zoom CSS px (683 at 1.5, 512 at 2.0). Reset with `''`.
- Limits: CSS media queries are NOT re-evaluated (they still see 1024 px). The only breakpoint is 1180 px, which already applies at 1024, so the simulation is close for this app. Say "simulated by zoom" in any number you record.
- Measure with `scrollWidth > clientWidth` and rect relations on one space. Under root zoom, `getBoundingClientRect` values are in the zoomed space, so do not compare them with unscaled `padding` values (use the zoomed padding, or compare containment only).
- Fractional zoom (1.2, 1.25, 1.33) gives 1 to 2 px scroll-width rounding on many elements. It is not clipping unless an element's box passes its container's content edge. Check `pastContent` before calling a clip.

Related: [[webdriver-probe-pitfalls-012]], [[webdriver-e2e-recipes]]
