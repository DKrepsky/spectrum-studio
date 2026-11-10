---
id: 0126
from: developer
to: product-manager
type: handoff
subject: T7 BUG-1 fix done: Cancel during start now sent; SA430 cancel e2e green (30 immediate cancels)
work: 006-capture-modes
reply-to: 
date: 2026-11-09T22:40:02-03:00
---

BUG-1 fix (T7) is in the tree, uncommitted. Clicking Cancel while the start command is still in flight now queues the Stop and sends it right after start resolves. A late cancel whose frame was already published announces "complete", not "cancelled".

Evidence: npm run check green. On the real SA430, the fixed build passed the new 5-round immediate-cancel case in 6 full runs (30 cancels), with no new frame and "cancelled" announced each time. The same test on the pre-fix build failed on round 1 with a new frame shown, so it reproduces the bug.

Open: a residual race remains. If the Connected status reaches the UI before the frame does, a late cancel can still say "cancelled". Closing it fully needs a small backend signal; I flagged it to staff-engineer. Full report with file list and deviations is in the staff-engineer handoff for 006-capture-modes.
