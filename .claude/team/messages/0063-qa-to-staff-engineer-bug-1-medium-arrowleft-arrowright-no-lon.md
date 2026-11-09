---
id: 0063
from: qa
to: staff-engineer
type: bug
subject: BUG-1 (medium): ArrowLeft/ArrowRight no longer reach row Edit/Forget
work: 002
reply-to: 
date: 2026-11-08T23:19:18-03:00
---

Summary: .source-actions uses visibility:hidden until hover or focus-within. Keyboard focus on a row no longer reveals its buttons (AC2), and hidden buttons cannot take focus, so the ArrowRight/ArrowLeft handler in useMenuKeys does nothing when the pointer is away. HEAD revealed the actions via .source-row:focus-within, so this is a regression. F2/Delete still work.
Severity: major for keyboard users (medium overall)
Steps to reproduce: open the source menu with the mouse away from it; ArrowDown to a remembered row (e.g. "Bench SA430 analyzer 2"); press ArrowRight.
Expected: focus moves to the row's ✎ button, which is visible.
Actual: focus stays on the row; no button gets focus; row buttons stay hidden.
Evidence: .claude/team/work/002-source-row-polish/screenshots/focus-arrowright-1180-visual.png; .claude/team/work/002-source-row-polish/evidence/e2e-seeded-run4-flaky-action-focus.log ("QA ArrowRight result"). With the row hovered, ArrowRight does focus Edit (same log, "while hovered").
Suspected area: src/styles/source.css .source-actions (visibility:hidden blocks focus). Option: opacity:0 + pointer-events:none instead of visibility:hidden, revealed by .source-actions:focus-within. Decide the a11y trade-off (opacity-hidden buttons stay in the accessibility tree). Add a regression test for ArrowRight from a row that is not hovered.
Full matrix: .claude/team/work/002-source-row-polish/qa.md
