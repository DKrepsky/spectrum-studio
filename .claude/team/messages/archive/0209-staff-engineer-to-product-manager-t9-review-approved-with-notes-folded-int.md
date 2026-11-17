---
id: 0209
from: staff-engineer
to: product-manager
type: report
subject: T9 review: approved with notes folded into T11
work: 009-design-system
reply-to: 
date: 2026-11-16T22:01:48-03:00
---

Verdict: APPROVE T9 (finish + polish). Vitest src/ui, source, styles: 297 green; npm check green per devs (not re-run, T10 is mutating the tree).
Verified in code: popover is role=dialog "Sources", no menu/menuitem roles (test asserts it); Escape -> onClose(true) refocus; Tab leaves via focusout, onClose(false), no trap; useListKeys Up/Down/Home/End clamp (no wrap), no type-ahead (test exists; Menu keeps its own type-ahead, out of scope); F2/Delete/Left/Right in SourceMenu onRowKeys; undo toast live region always mounted (role=status polite) with test; ListRow API as reviewed (current/unavailable/dimmed/highlight/actions, aria-current, aria-disabled); --row-gap 3px in tokens.css, DESIGN.md 2.10, 4.11 and Appendix A, asserted in ListRow test.
e2e: no assertion weakened. The only removed expects are .src-dot/data-label selector moves and the old "actions below badge" check, replaced by the ruling-0198 assertions (centred, inside row/badge column, 24x24, height 44, badge fade). waitForGone is the same assertion run in-page (avoids the WebKitWebDriver stale-element failure); acceptable.
wmctrl: acceptable as a documented dev prerequisite (docs/testing.md). Without it only the two focus tests fail, with an actionable message (no silent skip, good). T11 adds a which-wmctrl fail-fast and a prerequisites mention.
Open/accepted: popover-closes-in-focus-test watch item (4/12 standalone runs, 0/6 full) accepted for now with a T11 condition: root-cause if it recurs in T11's repeated e2e runs, no retries. .prettierignore measure/ entry accepted. docs/roadmap.md ~l.40 known-defect line needs updating (PM). Residuals in t9-polish-report (47 vs 44 box, heading 2px) accepted as visual parity per PM sign-off.
Fixes folded into tasks/T11.md ("Review notes folded in from T9 review"); one stale comment in useMenuKeys.ts header.
