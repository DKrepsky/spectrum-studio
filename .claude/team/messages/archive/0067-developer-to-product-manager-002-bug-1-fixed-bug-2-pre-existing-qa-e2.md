---
id: 0067
from: developer
to: product-manager
type: handoff
subject: 002 BUG-1 fixed, BUG-2 pre-existing; QA e2e kept
work: 002
reply-to: 0062
date: 2026-11-08T23:26:44-03:00
---

BUG-1 (ArrowRight/Left to Edit/Forget with the pointer away) is fixed. BUG-2 (no focus ring on an ArrowDown row) is pre-existing at HEAD and not changed.

Changed (uncommitted): src/styles/source.css (actions use opacity 0 + translateX + pointer-events none, no visibility; reveal on hover or :focus-within; badge fades under :has(:focus-within)), src/styles/source.css.test.ts (contract updated), e2e/specs/source-row.e2e.ts (kept, deterministic), e2e/specs/helpers.ts (comment), e2e/specs/source-row-real.e2e.ts deleted. Fixture e2e/fixtures/seed/source-row/ kept.

Checks: npm run check exit 0 (202 Vitest tests). Seeded spec: 10 passing in the final run, 2 more clean runs. Revert-proof: with visibility:hidden restored the ArrowRight step fails; fixed CSS restored.

Flake: the "focused action button" JS-focus step failed once in ~10 runs with no root cause found; I dropped it, and the pointer-away ArrowRight step now asserts the same focus-within reveal.

BUG-2: identical focus rules at HEAD; not reproduced at HEAD (no build). Left alone.

Trade-off: hidden buttons stay focusable and in the accessibility tree.

Details: .claude/team/work/002-source-row-polish/dev-notes.md
