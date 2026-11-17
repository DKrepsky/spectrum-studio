---
name: ui-css-token-contract
description: src/ui CSS must pass the token contract test; box-shadow literals fail it; run prettier only on your own folders
metadata:
  type: feedback
---

`src/styles/tokens.test.ts` rejects any `box-shadow` that is not a single `var(--x)`, so a 2px halo
ring cannot be written as `0 0 0 2px var(--color-halo-*)`. Draw it as `outline: 2px solid var(--color-halo-*)`
on the pseudo-element instead (same footprint, outside the box). A missing ring token is a DESIGN.md gap to
raise with the staff engineer, not something to fix in the test.

**Why:** work 009 T4 (StatusDot) hit this; the test is a contract, not a lint to suppress.

**How to apply:** before writing a shadow, ring or radius in `src/ui/**` CSS, check the token test's rules.
Never run `prettier --write src/ui` (it rewrites other tasks' in-progress folders); scope it to your own folders.
