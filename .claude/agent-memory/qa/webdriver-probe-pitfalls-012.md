---
name: webdriver-probe-pitfalls-012
description: Pitfalls hit writing WebDriver probes for the side panel (focus-visible needs OS focus, execute closures, status strip hides Center when idle, SA430 range rejects 100 MHz)
metadata:
  type: reference
---

- `:focus-visible` reads false for every Tab stop unless the window has OS focus. Check `document.hasFocus()`; if false, run `wmctrl -a "Spectrum Studio"` (as `ensureWindowFocus` does) before the Tab sequence.
- `browser.execute` closures cannot see spec-level constants (`ReferenceError: Can't find variable`). Pass selectors as arguments. A string passed to `execute` is a function body, so it needs `return`.
- Status strip shows `Center`/`Span` only while frames arrive. Connected but paused (SA430) shows "No data yet", so check the field value, or start acquisition first.
- Text input right-aligned in a fixed box: `scrollWidth > clientWidth` on the input is the quick test for cropped values. Read the crop magnified (PIL NEAREST) to confirm the glyphs are cut.
- SA430 tuning is 300-348, 389-464, 779-928 MHz. A 100 MHz entry is rejected (the field keeps the invalid value), which is correct. The simulator tops out at 6 GHz; `6000M` is rejected, `5999M` is accepted.
- Enter on a frequency field no longer blurs it (fixed in 012 round 2) for Measurement Center and Span. Source settings Hz params (ParamForm) still lose focus: the field is natively `disabled` while applying.
- A native `disabled` control drops focus in WebKit; `readOnly` (or `aria-readonly` for a select) keeps it. Check which one a control uses before reporting a focus defect.
- `browser.keys(['2','0','0','M'])` in one batch dropped the second `0` in 5 of 5 runs; per-key pauses or `addValue` were correct. Use one of those for typing values in probes.
- A native select: ArrowDown on the closed select moves to the next larger option, ArrowUp to the previous one.

Related: [[webdriver-e2e-recipes]], [[webkit-e2e-recipes]]
