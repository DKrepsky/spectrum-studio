---
id: 0046
from: developer
to: staff-engineer
type: handoff
subject: T16 done: e2e, visual guard, screenshots, docs (1 CSS defect found)
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:40:31-03:00
---

T16 done (e2e specs, visual guard, screenshots, docs). Nothing committed. No changes under crates/ or src/ (the CSS was reverted temporarily for the proof and restored byte-identical).

## Results
- `npm run check`: exit 0 (final run after all edits).
- `npm run e2e` (rebuild + all 10 spec files) with the real SA430 attached and `SPECTRUM_E2E_SA430=1`: exit 0, 10/10 files, 0 failures (visual 17 passing / 2 skipped; sa430 5 passing).
- `npm run e2e:run` without hardware: 9/10 on the first run; the 1 failure was an old flake in `failures.e2e.ts` (clicking `summary=Source settings` toggled the <details> closed after a re-render). I made it state-aware (`setSourceSettingsOpen`), then 3 consecutive runs 5/5. Hardware specs are skipped without the variable.

## Evidence per spec (files in e2e/specs/)
- add-source: first-launch menu (simulator, Open file, Add source, no Scan, no "Other sources"); Cancel and Escape discard; bad port -> "Test failed: Could not open /dev/...: No such file..." + "You can still save an untested source."; Save remembers, nothing connects (pill Disconnected); picking it -> command-error + red cross (`data-status=failed`) + "Failed"; duplicate name (case-insensitive) error, Save disabled. HW: /dev/ttyACM0 -> "Connection OK", "Serial number 08FF41E50F8B3A34", Save, ONE row, no separate detected row.
- edit-source: rename via pencil, survives restart (reloadSession); F2 opens it; file entry read-only (driver disabled, path readonly, no Test button); Forget in dialog + toast + Undo; connected lock (driver disabled, info note, no Test button, rename applies to toolbar button at once, state stays Acquiring and liveness live).
- migration-dup (seed = user's two real duplicate entries): exactly ONE row `SA430 08FF41E50F8B3A34`, `sources.pre-v3-<ms>.json` exists (v2, 2 records), sources.json v3 with 1 record, rename via Edit + restart -> still one row, still one backup. Replug/other-port is NOT testable by the harness (covered by Rust identity tests / hardware QA).
- migration (v1): updated to expect v3 + backup.
- persistence: rename now goes through the Edit dialog; forget uses revealRowActions.
- sa430 (HW, gated): detected without scan; add via Add source with real port + Test connection; rename via Edit; one row after restart; connect remembered row, live dBm; centre retune + restore after restart (SA430 snaps 434.5M to 434.499, so regex `Center 434.[45]`).
- visual: see below.

## Visual guard (e2e/specs/visual.e2e.ts)
Real pixels via getBoundingClientRect, seeded e2e/fixtures/seed/visual (real name SA430 08FF41E50F8B3A34, 22-char, 60-char, failing sim, file with long path, simulator). Asserts: name left/right identical across ALL rows (USB/File/Built-in), badge width 64 +-0.6 and identical left, row heights equal, line 2 present, truncation only with title; popover/dialog inside window, no horizontal scroll, `assertNoOverflow` on menu/dialog/button; hover+focus moves no rect of item/name/badge/line 2 and actions are inside the badge column and clear of line 2; button 150..280 wide, 22-char untruncated, 60-char ellipsised with full aria-label, page/toolbar do not scroll sideways; glyph computed styles (idle filled grey, absent transparent+2px ring, failed cross, connected green + halo; 3 distinct fills).
Guard-fails-when-reverted proof (then restored; `diff` against a saved copy is empty):
1. `64px -> auto` in `.source-item` grid columns and `.src-badge` width: 6 failures: "1180 (got 1180): badge width of SA430 08FF41E50F8B3A34 is 35.27" (same at 1024 and 520) and "actions start inside the badge column" at all three widths.
2. `max-width: 280px -> none` on `.source-control`/`.source-button`: 3 failures "Very long source name ... button width" at each width.
Restored build: all green.
Window widths: the app's minWidth is 1024, so 520 is clamped to 1024 (logged: "requested 1180/1024/520, web view got 1180/1024/1024"). The 520 requests therefore re-test 1024; `max-width: calc(100vw - 16px)` is only covered by the CSS contract test. Say so in qa.md.

## DEFECT found by the guard (not fixed: src/ is out of scope)
On two-line rows the hover/focus actions (pencil, x) start 5.5px ABOVE the bottom of the badge pill (actions top 181 vs badge bottom 186.5 at 1180), so their buttons cover the pill's lower edge (visible in row-actions-*, connected-halo-*, docs/images/source-menu before I blurred it). Design 2.1 puts them on line 2 under the badge. The assertion is written as `it.skip('hover actions sit below the badge pill ...')` in visual.e2e.ts (I ran it enabled: it fails with the numbers above); please fix `.source-actions` in source.css (e.g. smaller `bottom`/height or taller badge row) and change `it.skip` to `it`. Treat as a bug for QA.

## Screenshots viewed (Read tool); copies in .claude/team/work/001-simplify-source-journey/screenshots/ (29 files; also e2e/logs/visual by default)
- typical-menu-1180-seeded: ok. Six rows, one name column, 64px USB/File/Built-in pills aligned, circles distinct (grey filled / ring for Not detected), line 2 status+port, path ellipsised, "No new devices found..." text, Open file/Add source.
- row-actions-1180-long-name: DEFECT above (pencil/x overlap the USB pill). 60-char name ellipsised "Very long source name used to check…" without moving anything.
- failed-row-1180-long-name: ok except same overlap; red cross + "Failed · /dev/ttyACM6", button shows cross + ellipsised name ≈280px. Two stacked error banners say nearly the same thing (observation for SE: duplicated error text).
- connected-halo-menu-1180-sim, connecting-forced-menu-1180-sim (state forced via data-status because the sim connects too fast): green with halo vs pulsing blue vs grey, distinct. Overlap defect visible again.
- absent-device-menu-1180-seeded / migrated-menu-1440-sa430: with the real SA430 attached the device is one row "SA430 08FF41E50F8B3A34 USB /dev/ttyACM0" (Connected in absent-device shot) - merge works; ring circles for the fake absent rows.
- first-launch-menu-1440-empty: ok; real device under Detected devices as "New · /dev/ttyACM0" (hardware attached), simulator below the separator.
- add-dialog-empty-1024, add-dialog-failed-1180-long-port, add-dialog-ok-1440-sa430, edit-connected-lock-1180-sim: ok, nothing clipped, long port wraps in the red box, OK box shows "Connection OK. TI SA430 spectrum analyzer found. Serial number 08FF41E50F8B3A34", lock note present. (Name field in the failed shot has a double space; that is my test data, not a bug.)
- button-long-name-1024-seeded: ok button; observation: at 1024 the "Spectrum Studio" brand wraps onto two lines when the button is 280px wide (toolbar, pre-existing layout).
- button-real-serial-1180-seeded: ok, full 22-char name, green circle.
- docs/images/main-window.png, source-menu.png, edit-source.png: ok (menu shot taken with focus/hover cleared, so the defect is not shown). source-menu shows the developer's home path in file rows (/home/kr/workspace/...): cosmetic.
- Not captured: "connecting" for real (forced instead), mismatch dialog (needs two SA430; `describe.skip`, no mock).

## Docs
user-guide (Add/Edit source, status circles table, one row per device, Forget in both places, migration backup, Test connection; 2 images), sources.md (identity contract, OpenedSource, normalize_device_id, location, test_source, discover only enumerates), file-formats.md (v3, backup, merge rules), architecture.md (commands, resolved config, store row), roadmap.md (stable-id limitation removed; BUG-2 and newer-version overwrite kept as open; unverified items updated; new Done row), testing.md (visual guard, hardware specs, screenshot dir), README (source-menu image + wording). `npm run docs:screenshot` now also writes source-menu.png and edit-source.png from seed e2e/fixtures/seed/screenshot.

## Deviations / notes
- wdio.conf seed lookup now strips `.e2e.ts` or `.ts` (so the screenshot tool can have a seed).
- Added helpers: openAddSourceDialog, openEditDialog, revealRowActions, fillDialog, testResultText, runTestConnection, entryByName, boxOf, rowRect, findOverflow, assertNoOverflow, shot (`{w}` = real viewport width, `SPECTRUM_E2E_SHOTS` overrides the dir).
- visual.e2e.ts wraps wdio expect to carry messages (wdio's has none).
- No new dependencies.
