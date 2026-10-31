---
id: 0055
from: developer
to: staff-engineer
type: handoff
subject: T18 done: R2-1, R2-2, R2-3 fixed
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T16:10:08-03:00
---

All three Round 2 bugs fixed, uncommitted in the working tree. No new dependencies, no binding changes.

R2-1 (one row per device)
- crates/spectrum-core/src/remember.rs: add_source / update_source call identify_by_location(): an enumerate-only discover() (never opens the device); if exactly one detected device's `location` equals a text connection value, its serial is stored as device_id. Ambiguous (2 devices) or none -> unbound as before. An explicit device_id from a test is kept. update_source binds only entries that have no id and are not locked; a bound entry keeps its identity when only the port hint changes (ADR 0010).
- Not done: the automatic `label` of the saved record is not filled (store.add_source has no label param; the user's name is stored).
- Defence in depth: src/state/sourceEntries.ts menuModel hides the detected row when an unbound entry's port equals a detected device's location.
- Tests: Rust tests/remember.rs +4 (scripted discovery driver: bind on add, none/ambiguous stay unbound, explicit serial kept, Edit binds unbound entry / bound keeps id); vitest menuModel test; hardware e2e add-source.e2e.ts "saving the detected port WITHOUT Test still leaves ONE row" (passes on the real SA430).

R2-2 (toolbar overflow). Root cause: `.app` grid had an implicit `auto` column, which grows to the toolbar's min-content; the long name's min-content is its full unwrapped text (overflow:hidden does not reduce it), so the column became ~39px wider than the window and was clipped (hence scrollWidth passed). Fix in src/styles/app.css + Toolbar.tsx: `.app{grid-template-columns:minmax(0,1fr)}`, `.toolbar{min-width:0}`, groups `flex:none`, only the source group (`toolbar-source`) shrinks (`min-width:0`), its other children `flex:none`, so the name column gives way down to the button's 150px min.
- Guard: e2e/specs/visual.e2e.ts new `assertChromeFits` (scrollWidth, toolbar and every toolbar child right edge, side panel right edge, Export CSV left/right all within innerWidth) at 1180 and 1024, names 22 chars, real-serial name, 60 chars, idle (seeded failed/disconnected) and connected + acquiring (simulator renamed via Edit). 
- Proof it fails on the old CSS: first run of the new guard against the old CSS failed: "idle 60 chars at 1024: toolbar right edge 1038.67 > 1024" and "acquiring 60 chars at 1024: toolbar right edge 1161.14 > 1024" (log: ${SC}/vis-old-evidence.log). With the fix: 22 passing in visual.e2e.ts.

R2-3: src/state/sources.ts forget() clears `active` when the forgotten entry is the active one and session state is disconnected (connected/acquiring/connecting keep it). It imports useSession (cyclic import with session.ts, only used inside a function; lint/tsc/tests fine). Tests: two vitest cases (connected keeps, disconnected clears, other entry untouched); e2e add-source.e2e.ts "forgetting the selected, not connected source clears the toolbar button" (button "Source: Choose a source" aria, Run disabled).

Docs: docs/user-guide.md two sentences (forget clears selection; untested save binds to detected device).

Gates (observed)
- npm run check: exit 0 (Vitest 22 files / 202 tests).
- npm run e2e: 9 spec files passed, 1 failed on the first run only because my new R2-3 test asserted the wrong aria text; fixed. Re-ran add-source.e2e.ts alone: 6 passing, 2 skipped (hardware).
- SPECTRUM_E2E_SA430=1 npm run e2e:run: exit 0, 10 of 10 spec files passed (visual 23 passing/1 skipped mismatch, add-source incl. new R2-1 test, sa430 5 passing) on the real SA430 /dev/ttyACM0.
- I did not rerun the whole non-hardware `npm run e2e` after the one-line test fix (only add-source).

Screenshots LOOKED at (e2e/logs/visual/, real app)
- toolbar-acquiring-60-1024-seeded.png: Stop, Acquiring, SIMULATED, Center, Span, Export CSV all inside 1024; side panel complete with its scrollbar; name ellipsised ("Sim Very lo...") in the 150px button. (The PNG is 1180 wide with the 1024 window in its left part; the rest is black, a resize-capture artefact.)
- toolbar-idle-60-1024-seeded.png: red x, name ellipsised, Run, Disconnected, Export CSV and right panel fully visible; one error banner.
- menu-untested-save-1440-sa430.png: after untested save of /dev/ttyACM0: exactly one row "Untested Bench SA430 /dev/ttyACM0", "No new devices found" under Detected devices.
- forget-selected-1440-cleared.png: button "Choose a source", Run greyed.
- failed-row-1440-untested.png: hover actions (pencil, x) sit under the USB badge, row "Failed" with red x, single banner with Reconnect.

Concerns
- After forgetting a failed source the old "Could not connect to ..." banner stays until dismissed (visible in forget-selected screenshot); not in scope, may deserve a follow-up.
- At 1024 acquiring with a 60-char name the source button is at its 150px minimum, so only ~8 characters of the name show (full name in tooltip/aria). Acceptable per design (min 150) but tight.
- Real-device replug / mismatch states remain unverified (need physical changes / two analyzers).
