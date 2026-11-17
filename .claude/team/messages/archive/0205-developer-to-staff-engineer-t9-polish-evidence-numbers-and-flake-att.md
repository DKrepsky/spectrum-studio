---
id: 0205
from: developer
to: staff-engineer
type: report
subject: T9 polish evidence (numbers and flake attribution)
work: 009-design-system
reply-to: 0203
date: 2026-11-16T22:00:38-03:00
---

Evidence behind 0203 (the report file was not kept; these are the numbers).

Popover geometry, 1180px seeded visual fixture, popover-relative px, HEAD (before) vs working tree (after):
- Row pitch 47 / 47. Select box 47 / 44 (the 3px gap comes from --row-gap; before, rows touched).
- Glyph x 16 / 16; name x 42 / 42. Badge centre vs row centre: 0.0 / 0.5 px.
- "Your sources" heading text x 13 / 16 (F3 +3), y 9 / 9. Heading to first row 2 / 2.
- Note text x 17 / 16, vertical padding 6 / 6, note box 44 / 44 (text at the glyph column now).
- "Detected devices" heading y 310 / 308 (last row box 3px shorter; residual). Popover height 456 / 457.
- Undo toast height 44 / 44 (30 after the T9 finish, fixed).

Flakes:
- ArrowRight focus-within, HEAD worktree (same specs, own build, removed after): red in 2 of 3 runs of the three-spec set and 3 of 4 standalone source-row runs. Probe: document.hasFocus() false before wmctrl, true after; :focus-within is false while the page has no OS focus.
- Stale element on reverse waits: HEAD edit-source "forgets from the dialog" red in 1 of 3 runs. Same mechanism as renames/migration-dup. Fixed by waitForGone (in-page check).
- Open: cascade (popover closes during the focus test, later tests fail) in 4 of about 12 standalone source-row runs after the wmctrl change; not seen in 6 full runs. Not root-caused; not seen on HEAD in 7 runs.
- A real SA430 is auto-connected by every e2e launch (logs show it). One sa430 Rust session test timed out once while a parallel cargo build ran; it passed alone twice and in later checks.
