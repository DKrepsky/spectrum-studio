# QA 001 Simplify the source journey

Date 2026-10-31. Tested the uncommitted working tree. Logs: scratchpad `qa-check.log`, `qa-e2e.log`, `qa-sa430.log`,
`qa-hw.log`, `qa-sw.log`, `qa-sw2.log`, `qa-sw3.log` (dir `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/96e75e90-8022-48fc-b2d6-ae90da2a90ef/scratchpad/`).
Probe specs (QA-owned, not in the regular suite): `e2e/qa/hw.qa.ts`, `e2e/qa/sw.qa.ts`, `e2e/qa/sw2.qa.ts`, `e2e/qa/sw3.qa.ts`.
Screenshot: `e2e/logs/qa-menu-first-launch.png`.

## Gates
- `npm run check`: exit 0. cargo fmt + clippy -D warnings clean; cargo tests 82+2+8+11+4+6(1 ignored) passed; Prettier, ESLint, tsc (app+e2e) clean; Vitest 19 files / 131 tests passed.
- `npm run e2e`: exit 0, 6 spec files: acquisition 8, failures 5, files 2, migration 3, persistence 5 passing; sa430 skipped (1) without the env flag.
- `SPECTRUM_E2E_SA430=1 npm run e2e:run -- --spec e2e/specs/sa430.e2e.ts`: 1 passing (real device).

## SA430 hardware truth
Device IS attached: `lsusb` -> `2047:0005 Texas Instruments SA430 CDC COM Port`; `/dev/ttyACM0` crw-rw---- root:dialout; user kr is in `dialout`; nothing holds the port (fuser empty).
The developer who says "none attached" is wrong at the time of testing. Unplug cannot be done by QA (no root, no physical access).

## Matrix (P pass, F fail, NV not verified)
| # | Criterion / case | Result | Evidence |
|---|---|---|---|
| 1 | Start: one source control, no Connect/Switch/Sources..., no dialog | P | probe P0: toolbar buttons = source-button "Choose a source", Run, Export CSV only. Run disabled, hint "Choose a source to begin. Try Signal simulator." |
| 2 | Device plugged in listed without Scan (real SA430) | P | hw probe: first launch menu "Detected devices / SA430 08FF41E50F8B3A34 / Serial" after opening, no Scan control; sa430 e2e passing |
| 3 | Pick other source (running or not): stops, connects, shows name, no confirmation | P | sw2: acquiring Alpha -> pick Beta: Connected, button "Source: Beta, Connected", not auto-running, status dBFS "Uncalibrated". Failed pick while acquiring -> Disconnected (sw P2) |
| 4 | Open file...: type chosen automatically | P (unit only) | native dialog cannot be driven by WebDriver. SourceMenu.test.tsx "connects a recording by the driver its extension selects" (.cf32 -> iq-file, .CSV -> trace-csv); e2e files via seeded entries |
| 5 | Remembered with settings, restored after restart, no save step | P | sim e2e persistence; real SA430: set centre 867.998 MHz, restart, menu lists SA430 under Your sources, pick+Run -> Center 867.998 MHz. Span: SA430 offers one span only, so span restore NOT exercised on hardware |
| 6 | Forget removes; not re-added until used | P | sw P2: Forget -> toast + Undo (restores), after 5 s gone from menu and file; Delete key forgets |
| 7 | Failed connection shows backend message, stays Disconnected | P | failures e2e + sw P2 (failConnect while acquiring: message shown, Disconnected, entry not Connected) |
| 8 | Planned drivers appear nowhere (menu, tooltips, aria, forms) | P | sw P0: DOM text + all title/aria-label scanned for soapy/tinysa/rtl/scpi/planned/hackrf/usrp/airspy: none; v1 seeded soapysdr entry hidden |
| 9 | sources.json v1 -> entries appear with settings, lossless | P with caveats | migration e2e; sw P2: hidden ghost/soapy entries keep ids/names/config after rewrite. Caveats: BUG-2 (unknown JSON fields and names >80 chars dropped), BUG-3 duplicates |
| 10 | Run connects nothing beyond active source; Disconnect in menu | P | sw P1: Disconnect in menu, button keeps name, Run reconnects the same source -> Acquiring |
| 11 | Docs/unit/e2e updated, check green, e2e passes | P | gates above. User guide not re-audited line by line |
| E1 | First launch empty | P | menu: Detected, Signal simulator, Open file..., Other sources... |
| E2 | Menu open/close 21x over 35 s while acquiring SA430 | P | hw probe: frame seq advanced to 318 (about 9 fps), liveness always `live`, never stale, max observed gap 1.2 s (includes WebDriver polling) |
| E3 | Menu open 3.5 s while acquiring simulator | P | liveness stayed live |
| E4 | Keyboard: Ctrl+K, Arrow/End, Esc returns focus to source button, Tab closes | P | sw P0 |
| E5 | Escape/focus inside inline form with no required field | F | BUG-1 |
| E6 | Rename (60 char cap), Rename+Escape cancels, Forget focus moves to Undo | P | sw P2 |
| E7 | Rapid picks (4 in <1 s) | P | ended Connected on the last picked source |
| E8 | Name with HTML (`<img onerror>`), 200-char name | P | rendered as text, document title unchanged; long name ellipsised |
| E9 | Corrupt sources.json | P | backed up as sources.corrupt-*.json, defaults loaded, banner (command-error) tells the user where the backup is |
| E10 | >200 entries on disk | P | 210 loaded and listed; remembering a new one evicted the least-recent so count stays 210 (does not shrink to 200) |
| E11 | Unplug during run -> device-lost banner + Reconnect on real SA430 | NV | cannot unplug; simulator device-loss path passes in failures e2e |
| E12 | Pick while acquiring on real hardware (SA430 -> simulator -> SA430) | NV | not run |
| E13 | Open file... native dialog manually | NV | not drivable |
| E14 | version 99 sources.json | NV | accepted without a warning; whether it is overwritten as v2 was not checked |

## Bugs
- BUG-1 minor/major(a11y): inline form without required fields leaves focus on BODY; Escape does nothing.
- BUG-2 minor: v1 migration drops unknown JSON fields and truncates names over 80 chars on load.
- BUG-3 cosmetic: identical legacy duplicates show as two identical rows.

---
# Round 2 (rework after the human rejected build 1)
Date 2026-10-31. Tested the uncommitted working tree. Logs in scratchpad (`r2-*.log`). Probe specs (QA-owned, deleted at the end): `e2e/qa/r2{a..e}.qa.ts`; screenshots in `screenshots/r2/`.

## Gates (observed)
- `npm run check`: exit 0 (with QA probe files moved out; they only fail Prettier). Rust 108+2+8+11+13+14+8(1 ignored) passed, clippy -D warnings clean, ESLint clean, tsc app+e2e clean, Vitest 22 files / 200 tests passed.
- `npm run e2e` (build + 10 spec files): exit 0. 10 spec files passed; visual guard 17 passing, 2 skipped (real-SA430 add dialog, mismatch state needs two analyzers); sa430 spec skipped without flag.
- `SPECTRUM_E2E_SA430=1 npm run e2e:run`: exit 0, 10 spec files passed; visual 18 passing 1 skipped (mismatch, needs 2 analyzers); sa430 spec 6 passing on the real device (serial 08FF41E50F8B3A34).

## Matrix (R2) - P pass, F fail, NV not verified
| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1a | "Other sources..." gone; menu has "Add source..." | P | rows: detected devices, Signal simulator, Open file..., Add source... (r2a log); `menu-sa430-detected-not-remembered-1180-real.png` |
| 1b | Add dialog: Name, Driver (SA430 only), Serial port, Test connection (inline), Save/Cancel; Save disabled until name+port | P | `add-dialog-idle-1180-empty.png` (driver options: only "TI SA430 spectrum analyzer"); log "save disabled true" with empty name/port |
| 1c | Test ok / failed inline; real device | P | `add-dialog-test-ok-1180-real.png` (serial 08FF41E50F8B3A34), `add-dialog-test-failed-1180-badport.png` |
| 1d | Test does not disturb a running source | P | real port while simulator acquiring: OK, state stays Acquiring (`add-dialog-test-ok-while-simulator-acquiring-1440-real.png`); while the real SA430 acquires: same port -> "in use by the active source" (`add-dialog-test-in-use-1180-real.png`), bad port fails, stream stays live after Cancel |
| 1e | Save remembers without connecting; pick connects | P | after Save: state Disconnected, button "Choose a source"; picking connects and acquires on the real SA430 (dBm sweeps, `connected-acquiring-menu-1180-real.png`) |
| 2a | Detected + remembered = ONE row | F (partial) | P for migrated, tested, connected. F: untested Add of a detected port gives two rows (BUG R2-1, `menu-sa430-remembered-after-save-1180-real.png`) |
| 2b | Real sources.json copy (2 duplicate SA430) -> one row, name kept, backup | P | seed = byte-equal data to the real pre-migration backup; v3, one row, `sources.pre-v3-*.json` has 3 entries v2; `migrated-real-copy-menu-1180-real.png`. e2e `migration-dup` passes |
| 2c | Rename survives restart, one row | P | Edit rename "Real bench", `browser.reloadSession()`, still one row (`menu-after-rename-restart-1440-real.png`) |
| 2d | Replug on another port | NV | physically impossible; scripted Rust backend tests only (cargo test, `remember`/`session` tests pass); mismatch UI state skipped in e2e (needs two analyzers) |
| 3 | Name overflow 22/60 chars, constant name column, tooltip, actions not overlapping, toolbar not wrapping | P at 1180, F at 1024 for 60 chars | 22-char at 1180 and 1024 clean (`connected-real-serial-name-1180/1024-real.png`, `menu-real-serial-name-1024-real.png`); 60-char ellipsised in button and row with full-name title, name column 194..424 for all rows, badge column 432/64, toolbar height 49 at all widths, popover inside window (`menu-hover-name60-1180-real.png`). F: 60-char at 1024 toolbar 39px wider than window, Export CSV and side panel cropped (BUG R2-2, `button-name60-1024-real.png`). Requested 520px window clamps to 1024 |
| 4 | Status circles | P / NV | green filled = connected/acquiring (`connected-acquiring-menu-1180-real.png`); red x = failed (`failed-connect-menu-1180-real.png`); gray filled = detected/idle (`menu-sa430-detected-not-remembered-1180-real.png`); hollow ring = not detected (`e2e/logs/visual/absent-device-menu-1180-seeded.png`, seeded absent device, not an unplug). Real unplug while connected: NV |
| 5a | Pencil and F2 open "Edit source", prefilled | P | `edit-dialog-detected-1180-real.png`, r2c log "F2 opened dialog title: Edit source", name focused |
| 5b | Forget in row and dialog with Undo | P | `forget-toast-row-1440-real.png`, `forget-toast-dialog-1440-real.png`; undo restores row and file (r2e log). Minor BUG R2-3 stale button name |
| 5c | Connected: name editable, port locked | P | `edit-dialog-connected-locked-1180-real.png`; rename applied live while acquiring |
| 5d | Escape / Tab / focus | P | Escape closes dialog, focus returns to source button; Tab cycles inside dialog (name, Forget, Cancel, Save); focus ring visible on name input; menu row focus `menu-row-focus-1180-real.png` |
| 5e | Planned drivers nowhere | P | driver select has one option; no planned entries in any menu |
| 5f | ONE error banner on failed pick | P | `failed-connect-banner-1180-real.png` (single banner with Reconnect) |
| 5g | Corrupt / newer sources.json | P | garbage file and a malformed "version 99" file: moved to `sources.corrupt-*.json`, defaults loaded, one banner naming both files (`bad-sources-menu-1180-g.png`). Note: the version-99 probe had a malformed entry so was treated as corrupt; the "newer valid file untouched" path is covered only by Rust test `newer_version_files_are_left_untouched` |

## Visual findings (screenshots in screenshots/r2/ unless noted; all LOOKED at)
- first-launch-closed-1180-empty.png: ok, hint "Choose a source to begin. Try Signal simulator."
- menu-sa430-detected-not-remembered-1180-real.png: ok, real name, New badge, gray dot, no Scan control.
- menu-hover-detected-1180-real.png: ok; hover shows pencil only, no layout shift (USB pill loses its background on hover: cosmetic, ignored).
- add-dialog-idle / test-ok / test-failed (1180): ok, inside window, nothing clipped, copy matches design.
- add-dialog-duplicate-device-1440-real.png: ok, warning "already in Your sources as ..." and Save disabled.
- menu-sa430-remembered-after-save-1180-real.png: DEFECT (two rows, BUG R2-1).
- connected-acquiring-menu-1180-real.png / connected-real-serial-name-1180/1024: ok, green halo dot, dBm label, Stop/Acquiring chips fit.
- edit-dialog-connected-locked-1180-real.png: ok, port disabled with explanation, Forget visible.
- edit-dialog-detected-1180-real.png: ok, "New device, not remembered yet" hint.
- failed-connect-menu / banner (1180): ok, red x, "Failed", one banner.
- button-name22-1024 ok; button-name60-1180 ok; button-name60-1024 DEFECT (BUG R2-2); toolbar-acquiring-name60-1024 DEFECT (stale frame in capture, overrun real per measurement).
- menu-hover-name60-1180/1024: ok, ellipsis + title, actions inside badge column.
- migrated-real-copy-menu-1180-real.png, menu-after-rename-restart-1440-real.png: ok, single row.
- forget-toast-row-1440-real.png: toast fits in menu; button still shows forgotten name (BUG R2-3).
- e2e/logs/visual/absent-device-menu-1180-seeded.png, narrow-menu-1024-seeded.png: ok, hollow rings, "Not detected", equal columns, file path ellipsised.
- bad-sources-launch-1440-g.png: banner readable; capture is a 1440 viewport cropped (resize lag in the probe), not an app defect.

## Bugs filed
R2-1 major (messages 0048/0049), R2-2 major (0050/0051), R2-3 minor (0052/0053).
## NOT VERIFIED
Replug on another port; real unplug while connected/acquiring; "Different device on this port" state (needs two analyzers); real hollow ring from an actual unplugged remembered device (seeded absent device used instead).
