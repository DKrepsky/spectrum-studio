---
id: 0225
from: designer
to: product-manager
type: handoff
subject: DESIGN.md reconciled with shipped 009 (draft 4)
work: 009-design-system
reply-to: 0222
date: 2026-11-16T23:30:30-03:00
---

DESIGN.md is reconciled with what shipped in 009 (`/DESIGN.md`, now 1.0-draft.4, "Implemented in 009; final QA pending"). I edited only DESIGN.md; no `src/` change.

Checks: `npx prettier --check DESIGN.md` passes. `npx vitest run src/styles/tokens.test.ts` passes (12/12); Appendix A equals `tokens.css` including comments, so no change was needed there.

What changed (details in 13.0 Draft 4):
- 4.4 and 12.1 D1: stacked labels are secondary in the dialog and the connect form.
- 2.15, 4.1, 4.3, 4.12, 12.1 U1: busy is not unavailable. Busy Save, busy buttons and the busy capture main keep full strength.
- 6.5, 6.8, 6.12, 7.4, 7.5, 12.1, 14: P11, P12, P13 are Deferred (backlog); P12 is prioritised.
- 2.9, 2.10: the `--source-test-*` and `--toolbar-*` tokens are named in the off-scale list and geometry table.
- 4.11, 5.1, 12.1 I19: popover Up and Down stop at the ends (no wrap, T5).
- 9.10, 12.1 A10: Peak search, Next peak and + Marker are native-disabled (T6). Logged as an accepted deviation; QA must confirm their reason is visible.
- 12.2 Q-23 (new, Open): the capture chevron is dimmed while a command runs. It is built that way; U1 would make it full strength.
- 13.0: changelog corrected. The draft 3 legacy statement was partly wrong; the test file paths in 10.3 and 12.3 are fixed; 2.7 and 2.19 cross-references are fixed.
- 14: F16 and F17 rows added. Backlog rows say Backlog.

Decisions for you to review:
1. Version bumped to 1.0-draft.4. Revert to draft.3 if you prefer.
2. Q-23 (chevron dimmed vs full strength while a command runs). Recommendation: full strength with aria-disabled, to match U1.
3. A10: are the native-disabled peak controls acceptable until QA confirms their reason is visible?

Follow-ups for src (not done, need a developer change; designer does not edit src):
a. `src/styles/tokens.css` and Appendix A still say "Proposed (F9)", "Proposed (F15)", "Proposed (B6)". They are stale. The fix is a comment-only change to both files at once, because the token test compares comments.
b. `src/ui/Field/Field.css` comment cites "DESIGN.md 3.6" for stacked labels; it should be 4.4.
c. `src/styles/capture.css.test.ts` is misnamed: it tests the SplitButton geometry.
d. `src/styles/app.css` has spacing and position literals not in 2.9 (for example `gap: 6px` on `.toolbar-field`, `left: 76px` on the zoom reset). The token guard does not check spacing, so these are recorded as findings.
e. Not verified: the ListRow test and visual e2e follow-ups from 13.4 (the Popover.css change is done).

Not reconciled: `.claude/team/work/009-design-system/prototype/index.html` was not re-checked against draft 4. DESIGN.md wins where they differ.

Pre-existing and unchanged: the source-row ArrowRight e2e check is red on main. 5.10 records this against the Arrow Left/Right row.

Work folder: `.claude/team/work/009-design-system/`. The design doc is `/DESIGN.md` (repo root).
