---
id: 0200
from: developer
to: staff-engineer
type: handoff
subject: T9 finish: 44px ruling applied, undo live region, check green, e2e not green in one run
work: 009-design-system
reply-to: 0199
date: 2026-11-16T21:17:29-03:00
---

T9 finish done, uncommitted, not committed. Nothing else in the tree was touched by me except the files below.

Changed (this finish):
- src/ui/Popover/Popover.css: .list-row-actions top: calc(50% - var(--target-min) / 2), bottom: auto (ruling 0198). Width, height, right unchanged. Row stays --row-height (44px); tokens.css already 44px, I did not edit it.
- src/ui/Popover/ListRow.test.tsx: geometry test now "centres the actions vertically in the badge column, with the row height unchanged".
- src/ui/Popover/ListRow.tsx: doc comment only (actions centred, badge fades).
- src/styles/source.css: comment only. Fade rule unchanged: .list-row:hover or .list-row:has(.list-row-actions:focus-within) fades the badge, matching the reveal rule (.list-row:hover or .list-row-actions:focus-within).
- src/components/source/SourceMenu.tsx: undo toast in an always-mounted polite region. <li key="toast-slot"> holds <div role="status" aria-live="polite" data-testid="source-forgot-live">; the toast div (data-testid="source-forgot-toast", Undo) is inserted into it only while forgotten is set. The slot li is always in the group list at the forgotten position (empty and zero-height when no toast).
- src/components/source/SourceMenu.test.tsx: the forget test asserts the live region exists before the forget, role=status, aria-live=polite, and contains the toast.
- e2e/specs/visual.e2e.ts: "KNOWN DEFECT" test replaced by "hover actions replace the badge: the badge fades, the actions are centred in its column" (renamed because the old name is wrong now). It reveals via revealRowActions, waits for badge opacity 0, waits for the actions to settle, then asserts row height 44, actions centred on the badge column and on the row, inside the badge column and the row, and two 24x24 buttons. Prettier formatted.
- e2e/specs/source-row.e2e.ts: assertUnderBadge is now assertInBadgeColumn (centred, inside row, 24x24 buttons via new buttonSizes metric). Used by 4 hover tests. Comment updated.
- .prettierignore: added .claude/team/work/**/measure/ (the designer's row_geometry.html made prettier --check fail; same rule as evidence/ and prototype/). Config change, please confirm.
- .claude/agent-memory/developer/e2e-quirks.md: T9 section.

Checks:
- npm run check: EXIT 0 (last run after the final comment edits). cargo fmt, clippy -D warnings, cargo test workspace, prettier, eslint --max-warnings 0, tsc app and e2e, vitest 51 files / 501 tests.
- Unit (before check): src/ui/Popover, src/components/source, src/styles: 8 files, 128 tests green.
- Full npm run e2e, three runs (logs in .claude/team/... no; scratchpad t9/e2e-full-{1,2,3}.log):
  run 1: 10 spec files pass, 1 red: source-row "ArrowRight ... moves focus to its Edit button": "Edit is not focus-within its row". 100/101 tests.
  run 2 (with SPECTRUM_E2E_SHOTS=evidence/after-T9): 1 red: edit-source "renames through the pencil button": WebDriverError stale element in saveDialog (waitForExist reverse of the dialog after Save). source-row passed. 100/101.
  run 3 (shots again): 3 red: acquisition "a single capture takes exactly one sweep" (known flake in memory); migration-dup "keeps one row after renaming it and restarting" (stale element, same waitForExist reverse pattern); source-row ArrowRight again. 
  Alone: source-row ArrowRight red once (run 1 alone), passed in run 2; edit-source 4/4 pass; migration-dup pass; acquisition pass. visual.e2e.ts: 47/47 in runs 1 and 2, including the new hover test.
  So NOT green in a single full run. The ArrowRight red is the known one: 0192 (T7 finish) recorded it as a pre-existing red on the tree before T9, and T9 does not touch focus handling. I did not rebuild that earlier tree to prove it again. The stale-element reds are not in any memory; they come from the dialog close path (SourceDialog is unchanged in T9), but I have no before-code proof for them. Treat as open flakes; please decide whether T9 can close with them.

Deviations from the task / ruling:
- Renamed the visual test (see above) and rewrote the source-row helper; both are the ruling's assertions, not weakened ones.
- .prettierignore entry for measure/ (above).
- Did not touch docs/roadmap.md line 40 ("Open (known defect): the source-menu hover actions sit below the badge pill"). It is resolved by this change; PM to update it.

Open, not fixed (details in the PM handoff): row pitch 47 to 44px, "No new devices" note outdented ~8px, 2px left shift of content. Need a decision, not a fix from me.
