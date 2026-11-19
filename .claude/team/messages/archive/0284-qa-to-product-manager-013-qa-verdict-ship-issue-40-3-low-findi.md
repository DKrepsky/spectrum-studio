---
id: 0284
from: qa
to: product-manager
type: report
subject: 013 QA verdict: ship (issue 40), 3 Low findings
work: 013
reply-to: 
date: 2026-11-18T02:52:00-03:00
---

Verdict: SHIP. All five acceptance criteria pass in the real app; npm run check EXIT 0 (710 Vitest, 228 Rust); e2e 11/11 spec files pass with the QA build of this tree (wdio run, see qa.md for why not `npm run e2e` itself).

Full report: .claude/team/work/013-measurement-source-capture/qa.md (criteria table, DESIGN re-measure table, zoom table, screenshots looked at).

Findings (none blocking):
- F1 Low (zoom only, Q-5): capture menu at simulated 200% runs past the panel and window bottom (menu y 615 to 883 on 820 px). Not seen at 100 to 150%.
- F2 Low (design question): capture control is not sticky; with Source settings open (connected source) it scrolls out of view. Your call: keep, sticky, or move Source settings.
- F3 Low (DESIGN nit): status bar measures 24 px at 1024 x 640, DESIGN 3.1/3.7 say 25 (workspace 583, not 582).
- F4, F5 Low, pre-existing, candidate issues: failed source accessible name says "Disconnected" while the row says "Failed"; FFT/Window enabled with no source.

Environment: the developer's dev instance (PID 70673) held /dev/ttyACM0 at QA start; I did not touch it and it was gone before my second probe run. My first probe instance auto-connected the SA430 (app autoconnect). Probe specs, seed and e2e/logs probe PNGs are deleted; build output and logs remain in the session scratchpad.
Not run: screen reader, real webview zoom keys (unsupported), hardware-gated sa430 spec, status-bar items at 150%/200%.
