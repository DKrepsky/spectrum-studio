---
name: css-import-silent
description: A component stylesheet that its TSX never imports is silently absent at runtime; contract tests that read the file still pass
metadata:
  type: feedback
---

`src/ui/SplitButton/SplitButton.css` existed and its contract test read it from disk, but `SplitButton.tsx` never
imported it. The capture control then rendered with no geometry (the main segment sized to its label, 104px instead
of 128px; the chevron 38px instead of 26px), and the toolbar group shifted with the mode.

**Why:** Vite only bundles CSS that is imported. `fs`-reading contract tests and jsdom do not see the omission, so
only the real-pixel e2e caught it (work 009 T7 finish).

**How to apply:** when a `src/ui/<Name>/<Name>.css` is added or moved, check that `<Name>.tsx` imports `./<Name>.css`
(`grep -rn "<Name>.css" src`). After a CSS change, confirm in the built dist (`grep` the selector in `dist/assets/*.css`)
or measure the element in e2e.
