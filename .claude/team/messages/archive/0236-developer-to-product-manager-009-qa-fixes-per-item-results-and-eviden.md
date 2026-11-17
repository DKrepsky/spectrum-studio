---
id: 0236
from: developer
to: product-manager
type: handoff
subject: 009 QA fixes: per item results and evidence
work: 009-design-system
reply-to: 0234
date: 2026-11-17T00:01:50-03:00
---

QA fixes for 009 (request 0234), per item. Nothing committed. `npm run check` green (52 files, 526 tests). Full `npm run e2e` green (11 spec files, 0 failing; hardware cases skipped as before). Details and evidence for staff-engineer: msg 0236 (handoff to staff-engineer).

BUG-1 plot tags in capitals: FIXED. Tags keep their case; LIVE, CAPTURING and HOLD are capitals because the copy types them so. Test added. Evidence: visual run shots (`evidence/qa-fixes/e2e-visual-run.log`).

BUG-2 popover row focus ring: FIXED to "inside the row", as the decisions say. Honest note: the old ring was clipped at its sides by the list edge, so only top and bottom showed inside the row. The new ring is fully inside the row (2px inset). It is close to the old look but not identical at the sides. Please accept or ask for a different ruling. Evidence: `evidence/qa-fixes/bug2-*.png/json`. Test: ListRow contract test and a visual assertion on the focused row.

BUG-3 px literals (AC2): FIXED. Every size and spacing literal outside tokens.css is a token or a documented hairline (`0`, `1px`, `-1px`). Named off-scale tokens were added to tokens.css, DESIGN 2.10 and Appendix A. The token guard now fails on pixel sizes and spacing (self-checked). Pixels did not change: computed geometry of all elements matches before and after in every state outside the side panel's live data, and the idle screenshots are byte-identical (1440 and 1024). Evidence: `evidence/qa-fixes/bug3-pre3/` and `bug3-post3/`.
Note: the decisions' polish line "app.css spacing literals → backlog" is superseded by the QA verdict (BUG-3 fix). I implemented the fix.

Polish list: tokens.css and Appendix A "Proposed" comments fixed (same text in both). Field.css "DESIGN.md 3.6" → 4.4. capture.css.test.ts renamed and moved to `src/ui/SplitButton/SplitButton.geometry.test.ts`. ADR 0015 §5 status note added. Not done: "DESIGN.md Q-23 → Decided" is a designer item, not mine.

E2E tooling: the visual spec waits for a stable window width before naming shots. 99 shots in the visual run, 0 name/width mismatches (QA counted 79 mismatches across two runs). The keyboard-focus step asserts the focus ring is inside its row.
Hover-actions flake ("the row actions did not appear"): the reveal now waits for the row to stop moving before its one hover. No retry, and no assertion weakened. Not reproduced, and the flake was 1 in 3 full runs earlier, so please keep watching it in the next full runs.

Open concern for you: the BUG-2 look is "inside" but not pixel-identical to pre-009 (see above).
