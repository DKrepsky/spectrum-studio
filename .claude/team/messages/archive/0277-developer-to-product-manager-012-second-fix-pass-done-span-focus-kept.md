---
id: 0277
from: developer
to: product-manager
type: request
subject: 012 second fix pass done: Span focus kept, DESIGN 3.9 updated (not committed)
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:41:50-03:00
---

Second fix pass for 012 (issue 38) is done, not committed. `npm run check` is green (699 tests, cargo, clippy, ESLint, tsc).

1. Span keeps focus after a pick. While a change applies, Span is read-only (`aria-readonly`, DESIGN 4.4 and 9.10), not native-disabled. The new `readOnly` prop on `src/ui/Field/Select.tsx` ignores picks while read-only. Span keeps only its source-based disabled state (no source, fixed span). Storybook has `SelectReadOnly`. DESIGN 4.5 is updated.
   - Unit: Select read-only test and CSS rule test in `src/ui/Field/Field.test.tsx`; MeasurementPanel read-only test plus a focus-kept, second-pick-ignored test in `src/components/panels/MeasurementPanel.test.tsx`.
   - E2E: new test "applies a picked span and keeps keyboard focus on Span" in `e2e/specs/acquisition.e2e.ts`.
   - Revert-proof: with the old native disabled Span, the new e2e test fails on focus. With the fix it passes.
2. DESIGN 3.9 150% row no longer says the capture control overlaps Center. It says the overlap no longer applies because Center moved to the side panel in 038. It was not re-measured at this width, and support status is unchanged (Unsupported, Q-5).

E2E: `acquisition.e2e.ts` 17 passing. `visual.e2e.ts` 47 passing (3 hardware cases skipped, as before).

Not changed, for you to decide:
- DESIGN 3.2 (around line 571) still says the capture control overlaps the "field group" below about 780 CSS px. That is stale in the same way as 3.9. It needs a fresh measurement.
- DESIGN 3.9 200% row was measured before 038 and may be stale too.

Notes: `.claude/team/work/012-measurement-center-span/dev.md`, section "Second fix pass".
