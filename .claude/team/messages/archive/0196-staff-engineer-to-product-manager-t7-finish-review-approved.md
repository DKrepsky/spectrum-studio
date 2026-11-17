---
id: 0196
from: staff-engineer
to: product-manager
type: report
subject: T7 + finish review: APPROVED
work: 009-design-system
reply-to: 0195
date: 2026-11-16T20:44:07-03:00
---

Verdict: APPROVED, no blocking changes. Read-only (T9 in flight); follow-ups folded into tasks/T11.md.

Checked
- F0 StatusStrip: logic correct. Pinned items have no dropOrder, droppables sorted by dropOrder, one dropped per layout effect (pre-paint), reset on new items or resize, terminates. frameItems order matches the decision (Frame1 Rate2 Noise3 FFT4 Avg5 RBW6; Points shares FFT slot, fine). e2e status-bar.e2e.ts covers 1440/1257/1180/1024 with real layout (pinned present and unclipped, removal is a prefix of DROP_ORDER, nothing removed at 1440) plus the named 1024 Uncalibrated test. Meaningful assertions.
- Tokens: the four off-scale tokens are in tokens.css, DESIGN 2.10 table and Appendix A; token test green. Accepted as documented exceptions (T12 lists them).
- SplitButton API: describedBy on main/chevron, dataMode/dataState on main added; JSDoc fine. Minor: dataMode/dataState duplicated on group and main; T11 to delete the group pair if unread.
- C1 copy: "press Continuous"/"press Single" in StatusBar and plotHint, tests present; no "Play" left in non-test src.
- Missing-CSS-import class: my script found every src/ui/*/*.css now imported by its component (SplitButton was the only miss). No test catches it today. Specified a cheap guard in T11: for each src/ui/<Name>/*.css require an exact `import './<file>.css'` in a non-test tsx in that folder (exact filename, not substring), plus a check that src/components does not import component CSS.
- F16/F17 (primary-colour Center/Span, wider Span) accepted per your decisions.

Notes for T11 are in /home/kr/workspace/spectrum-kit/.claude/team/work/009-design-system/tasks/T11.md. Not run: npm run check/e2e (developer reports green, 99/101 with the two known reds, ArrowRight flake and T9 hover actions).
