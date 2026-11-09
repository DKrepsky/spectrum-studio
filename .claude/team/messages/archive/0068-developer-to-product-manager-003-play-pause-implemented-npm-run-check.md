---
id: 0068
from: developer
to: product-manager
type: handoff
subject: 003 Play/Pause: implemented, npm run check green, e2e visual guard regressed
work: 003
reply-to: 
date: 2026-11-08T23:50:06-03:00
---

Play/Pause toggle implemented per story.md. Not committed.

Changed (working tree):
- src/components/Toolbar.tsx: state pill and Run/Stop removed; one icon-only `acquire-button` (inline SVG Play/Pause, aria-label "Start acquisition"/"Pause acquisition", data-state idle|acquiring, title "Connect a source first" when disconnected). Play calls start() only when connected; Pause calls stop(). Disabled unless connected/acquiring, and while busy.
- src/state/session.ts + session.test.ts: run() and targetForActive() removed (no other users); its 5 tests removed.
- src/components/Toolbar.test.tsx: rewritten for the toggle (no pill, disabled states, Play without auto-connect, Pause keeps frameStore.latest).
- src/styles/app.css: .state-pill rules and the media-query rule removed; .acquire-button added (square, height var(--control-height)=30px).
- src/styles/source.css: .source-button gets height var(--control-height) so both controls match (a fixed 30px is a choice; natural height was not measured).
- e2e/specs/helpers.ts: sessionState() now parses the source button aria-label; acquireState() added; runSimulator presses acquire-button.
- e2e/specs/{acquisition,persistence,edit-source,failures,add-source,migration,sa430,visual}.e2e.ts: testids and pill assertions moved to sessionState()/acquire-button. persistence now connects before Play (Play no longer auto-connects). acquisition: new "pauses" (trace held, HOLD, idle label) and "plays again" tests; the old Run-enabled-while-disconnected assertion is now Play disabled.
- docs/user-guide.md, README.md: Run/pill wording updated.

Results:
- npm run check: EXIT 0 (cargo fmt/clippy/test, prettier, eslint, tsc app+e2e, vitest 22 files / 201 tests).
- npm run e2e (WebKitWebDriver from apt-get download, extracted to /tmp/claude-1000/wkd): 9 of 10 spec files pass. visual.e2e.ts: 19 passing, 3 failing on the final run.

CONCERN (regression, needs a decision):
- Baseline HEAD visual.e2e.ts: 21 passing, 1 failing (the documented KNOWN DEFECT "hover actions sit below the badge pill", pre-existing).
- With this change: "hover and focus move nothing, and the actions stay in the badge column" fails at 1180 and 1024px for the 60-char row (actions right 484.87 vs badge right+TOL 484.475, i.e. ~1px overshoot). On the earlier run it failed for the SA430 22-char row at 1180px by ~0.4px. The menu is a fixed 360px popover anchored at source-control left, which I did not move, so I have not pinned the cause. Suspects: the toolbar width change (the source button now gets the freed space) or the new fixed 30px height. I have not fixed it because it sits in source-menu geometry (out of scope). Options: I investigate further (measure source-control left and menu left before/after), or the staff engineer decides.
- Not visually verified yet: no screenshot review of the toolbar was done (the visual spec writes to e2e/logs/visual/ and I did not open them).

Other notes:
- A backup patch of this change is at /tmp/claude-1000/developer-003.patch (taken before a baseline stash; the working tree was restored, 17 files).
- Stop keeps the frame store: verified by unit test and by the e2e "pauses" test (liveness stopped, HOLD shown).
