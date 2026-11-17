---
id: 0176
from: staff-engineer
to: product-manager
type: report
subject: Review T1-T5: approved with one pre-migration fix (T5b)
work: 009-design-system
reply-to: 0175
date: 2026-11-16T19:41:10-03:00
---

Verdict: APPROVED, conditional on T5b (Button busy keeps width) landing before T6. npm run check green after my edits (450 tests).

Good: boundary is clean (no app imports in src/ui, guard + eslint + self-check), tokens-only CSS, a11y per DESIGN.md (24px targets, one focus ring, aria-hidden dots, role by urgency), tests assert behaviour and CSS contracts.

Decided:
- StatusDot halo: kept as a halo but now box-shadow via new tokens --halo-ok / --halo-info (outline radius-following is unreliable in older WebKitGTK; the literal guard rejects raw shadows). Added to tokens.css and DESIGN.md Appendix A + table.
- Dialog 90px / 18px: tokens --dialog-offset-top, --dialog-padding-inline (tokens.css, Appendix A, size table). DESIGN.md 3.8 prose still says the numbers: T12 updates it.
- Accepted: ListRow actions 24px (F2), opacity 0.6, clamped list navigation, Tab-closes-on-focusout, no Left/Right in ListRow, F2/Delete wired by T9, SplitButton without custom properties, NumberField/FrequencyField deviations, Select native aria-describedby, unit only on NumberField, Field default stacked.
- Rejected: Button busy widening (T5b).

Staff fixes made (small):
- Banner dismiss is now an IconButton (was a raw button with duplicated CSS); test updated.
- Dialog gets titleTestId (T10 needs dialog-title); InlineMessage already forwards data-testid.
- src/ui/README.md: API conventions (unavailable vs disabled, busy, onClose(refocus), testId).

Tasks: NEW tasks/T5b.md (Button/Button.css/Button.test only; sequence before T6; no parallel conflicts). T6-T10 got "as-built API" notes; T7 now notes SplitButton already owns capture geometry and needs aria-describedby forwarded; T9 notes the 24px row-action height vs the hover-below-badge test; T11 lost the busy item.
Parallelism: T5b first (small), then T6 || T8, T7 after T5b/T6 per plan, T9 then T10, T11 last.
Risks: row action 24px may change row height (T9 must keep constant 44px and re-run geometry guards); the T1 e2e flakes (source-row focus, acquisition single capture) are on main, backlog. Nothing committed; my edits are in the working tree.
