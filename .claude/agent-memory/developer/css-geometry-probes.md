---
name: css-geometry-probes
description: How to prove a CSS-only geometry refactor changed no pixels (computed-style dump, pixel diff), and why an outside focus ring looked inside before 009
metadata:
  type: reference
---

- Pixel-literal guard: `tokens.test.ts` `sizeViolations` checks padding, margin, gap, inset sides, width,
  height, min/max, grid/flex sizes, font-size, outline and border widths. Hairlines `0`, `1px`, `-1px` only.
- Before/after proof for a token refactor: a throwaway wdio spec that walks `document.body` and returns, per
  element, `getComputedStyle` for ~30 size props plus `getBoundingClientRect`, keyed by DOM path. Write it to
  `PROBE_OUT` with `writeFileSync`, diff in Python. Run it on the pre-change binary (copy it aside after a
  build) and on the post-change binary.
- The side panel shows simulator data (peak and marker rows change between runs): its diffs are data, not CSS.
  Compare the sidebar in the idle state (no data) and compare other regions without it. Idle screenshots of the
  whole window must be byte-identical; a live shot differs only where the trace shows through.
- Element counts must match between runs, or the state is not the same. Check which target classes the probe
  actually reached (a zero-diff over a state that never rendered the class proves nothing).
- A focus ring with `outline-offset: 1px` on a row inside an `overflow` list looks "inside": the list clips the
  side edges, leaving only the top and bottom. Pixel-measure the ring (find the (90,169,255) pixels in a row
  of the screenshot) before calling a ring inside or outside.

**Why:** QA BUG-2/BUG-3 (work 009). **How to apply:** before a CSS-only change is called "pixel-identical", run the
probe pair and state what it covered.
