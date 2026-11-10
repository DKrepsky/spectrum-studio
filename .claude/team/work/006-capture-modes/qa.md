# 006 Capture modes: QA

Tested: working tree on `main` (uncommitted), 2026-11-09/10 local. Hardware: TI SA430 `08FF41E50F8B3A34`
on `/dev/ttyACM0`. Real app: debug build, WebKitGTK via WebKitWebDriver (tauri-driver).
Verdict: **ship** (re-verified 2026-11-09 after the BUG-1 fix, T7; see section 9). BUG-1 is fixed and
re-tested on the real SA430 (28 immediate-cancel rounds, 0 frames shown after Cancel; 5 immediate
Pause rounds in Continuous, 0 lost clicks). The only failing tests are the 4 pre-existing
`visual.e2e.ts` failures, unchanged, which need a PM decision (section 5), not a 006 defect.

Screenshots: `.claude/team/work/006-capture-modes/screenshots/` (`<state>-<width>.png`, measurements
`<state>-<width>.json` next to each one: rects, labels, aria, badge, status text). Data: simulator
renamed to the 60-char name `Very long source name used to check that truncation is clean` unless
the file says otherwise; SA430 = real name `SA430 08FF41E50F8B3A34`. The `dev-*.png` files in that
folder were made by the developer, not by QA; they are not used here.

## 1. Automated gates

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run check` (final tree, before my QA spec was added) | PASS, exit 0 | cargo fmt, clippy -D warnings, `cargo test --workspace` (spectrum-core 98 + 8 + 16 + 24 unit/integration, sa430 driver 25 + 12, 6 hardware and 1 ignored by design), Prettier, ESLint, tsc app+e2e, Vitest 247/247 in 25 files. Log: `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/a640f3fc-2223-4a00-85a4-79b77b8f32a1/scratchpad/check.log` |
| `npm run check` re-run 2026-11-09 after T7 and with the QA spec edits (final tree) | PASS, exit 0 | Rust: spectrum-core 98, 8, 16, 25 + sa430 25/12 (6 hardware, 1 ignored); Prettier; ESLint; tsc; Vitest 259/259 in 25 files. Log: `scratchpad/check-qa3.log` |
| `npm run check` re-run after my QA spec | not re-run as a whole; QA spec passes prettier and `tsc --noEmit -p e2e/tsconfig.json`; ESLint ignores `e2e/` by config | |
| `npm run e2e` (debug build, WebKitWebDriver from apt, no root) | EXIT 1 only because of `visual.e2e.ts`: 9 spec files PASS, visual 19 pass / 4 fail (section 5) | `scratchpad/e2e.log` |
| `SPECTRUM_E2E_SA430=1 ... sa430.e2e.ts` (real SA430) | PASS 6/6 | `scratchpad/sa430spec.log` |
| `e2e/specs/qa-capture-tour.e2e.ts` (QA-only, `SPECTRUM_QA_TOUR=1`, real SA430) | before fix: 6 pass, 1 fail (the SA430 cancel check, BUG-1). After fix (2026-11-09): 10/10 with `SPECTRUM_QA_BUG1=1` | `scratchpad/tour11.log` (before); `scratchpad/tour-retest1.log` (after) |

Other e2e specs, one run: acquisition 15/15 (incl. "a single capture takes exactly one sweep and
stops by itself", "a second press takes a new single capture", "cannot change the mode while
acquiring"), persistence 5/5 (Single saved and restored after restart), source-row 10/10 (the
developer saw 1 failure on HEAD; passed here, so it is flaky), failures 3/3, migration 3/3,
migration-dup 3/3, add-source 6/6, edit-source 4/4.

Unit tests reviewed (asserting behaviour, not just running code): Rust store tests
`capture_mode_defaults_to_continuous`, `capture_mode_persists_across_reopen`,
`unknown_stored_capture_mode_loads_as_continuous_and_keeps_the_rest`,
`a_non_string_stored_capture_mode_also_loads_as_continuous`; core
`stop_during_a_single_sweep_discards_it` (asserts no frame is published after Stop, state Connected,
no notice); single-capture tests for one raw sweep, read errors, device loss and timeout. The
Vitest `CaptureControl.test.tsx` (27 cases) covers labels, aria names, the live region and the
failure-announcement rule. The UI has no timer that stops acquisition: the only `setInterval` in the
capture path is the 250 ms badge refresh in `src/state/liveness.ts`.

## 2. Acceptance criteria (story.md)

Status key: PASS (observed by QA), PASS-test (only by automated test), FAIL, NOT RUN (not
observable in the real app; say why).

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | Two-part control: main button shows mode label + play/pause, chevron on the right opens a mode menu | PASS | `continuous-idle-1440.png`, `single-idle-1440.png`, `menu-open-continuous-1440.png`, `menu-open-single-keyboard-1440.png` (menu: CAPTURE MODE, Continuous / Single with descriptions and checkmark, matches design section 4) |
| AC2 | Main colour by mode (purple single, accent continuous), WCAG AA for label/icon in all states | PASS (contrast computed from the tokens, not from pixels) | Label ratios from `app.css`/`capture.css` tokens: Continuous `#062018` on `#3ee0b5` 10.21:1; Single `#120a24` on `#a47cff` 6.31:1; Single hover 4.95:1 (AA). Screenshots show purple and teal fills with dark ink. Disabled (0.45) and locked (0.55) are exempt and labelled by text. |
| AC3 | Continuous behaves like today's Play/Pause (frames keep arriving; Pause freezes the last trace) | PASS | `continuous-acquiring-1440.png` (Pause icon, LIVE), `continuous-paused-hold-1440.png` (Play icon, HOLD, same trace); acquisition e2e "pauses" and "plays again" pass |
| AC4 | Single: one complete sweep, shown, then stops; button back to idle; press again = new capture; cancel while in progress | PASS (after the BUG-1 fix, section 9): simulator, SA430 sweep, auto-stop, and SA430 cancel (28 immediate-cancel rounds, no frame shown). | Simulator at 1440 and 1024: frame +1, no further frames in 1.5 s, state Connected, badge HOLD (`single-auto-stopped-hold-{1440,1024}.png`). SA430: frame +1, no further frames, `sa430-single-auto-stopped-1440.png` (HOLD, Frame #1, unit dBm). Second press: e2e. SA430 capturing: `sa430-single-capturing-1440.png` (square Stop icon, "Cancel single capture", CAPTURING badge, "Capturing one sweep…"). Cancel: PASS after the fix (section 9, `screenshots/bug1-retest/bug1-cancelled-settled-1024.png`). |
| AC5 | Auto-stop by backend via SessionStatus; no UI timer; works for simulator and SA430 without device code in UI/session | PASS | Stop happens without a Stop press in both sources (sections above). No acquisition timer in UI (section 1). Bound/timeout is in Rust (`fail_acquisition`, 30 s deadline) and tested by `single_capture_without_a_sweep_times_out`. |
| AC6 | Default Continuous on first run; remembered across restart; validated in Rust on load | PASS | First run (fresh config) shows Continuous (`disabled-no-source-continuous-1440.png`). Restart with Single: `restart-restored-single-disconnected-1440.png` shows Single after reload, persistence e2e passes. Unknown and non-string stored values load as Continuous (store tests). |
| AC7 | Mode changes while acquiring follow design; whole control disabled while disconnected | PASS, except busy state | Locked chevron while acquiring: `continuous-acquiring-chevron-locked-{1440,1024}.png` (chevron dimmed, aria-disabled, click opens nothing). Disconnected with Single: `disabled-disconnected-single-{1440,1024}.png` (main and chevron dimmed, label still shows the mode). Disabled without source: `disabled-no-source-continuous-1440.png`. NOT RUN: the "command in flight" aria-disabled state (design state 3/8) lasts a few ms in the real app; not caught in WebKitGTK. Covered by Vitest only. |
| AC8 | With averaging on, single delivers exactly one raw sweep and stops | PASS (simulator, SA430) | Simulator averaging 4: `single-averaging-4-hold-{1440,1024}.png`, status bar "Avg 1/4", frame +1, then stop. SA430 averaging 4: `sa430-single-averaging-4-1440.png` "Avg 1/4" with frame +1 (run of 22:06; the later run stopped before this step because of BUG-1). |
| AC9 | SIMULATED badge removed; simulator still identifiable by source button name | PASS | No "SIMULATED" text in any screenshot; no `simulated-badge` in `src/` (only in tests as "not present"). Source name in the button, e.g. `e2e/logs/visual/toolbar-acquiring-22-1024-seeded.png` shows "Simulated bench unit 2" (user-named simulator), and the accessible name "Source: <name>, <state>" is asserted by e2e. |
| AC10 | Disabled/tooltip/a11y rules from 003: disabled without source and during transitions; keyboard menu; accessible names state mode and action; visible focus ring; no layout shift | PASS, except tooltip text and busy state | Keyboard (QA tour, passes): Tab from main to chevron; ArrowDown opens with focus on the checked item (`keyboard-menu-open-focus-single-1440.png`); ArrowUp wraps to Continuous (`keyboard-menu-focus-continuous-1440.png`, blue ring on the item); Enter chooses and returns focus to the chevron; Escape closes with mode unchanged; Space starts and Enter pauses on the main button with focus kept (`keyboard-focus-main-acquiring-1440.png`, `keyboard-focus-main-paused-1440.png`). Focus ring is one 2px blue ring around the whole control (`keyboard-focus-chevron-1440.png`, zoomed check: ring visible on purple and teal). Accessible names read from DOM: "Start single capture", "Cancel single capture", "Pause continuous acquisition", "Start continuous acquisition", "Capture mode: Single". Layout: see section 3. Tooltip text: not read in the real app (native `title`), covered by Vitest only. |
| AC11 | Rust and frontend unit tests and e2e updated; `npm run check` passes; QA screenshots of both modes in idle/acquiring/disabled/menu-open | PASS (with the BUG-1 and visual notes) | Section 1 and the screenshot list in section 4. |

## 3. Layout and width measurements (WebKitGTK, real fonts)

From the JSON next to each screenshot (`getBoundingClientRect`, real pixels):

| Scenario | Width | Control width x height | Chevron left | Center field left | Source button width | Toolbar overflow | Source name overflow |
| --- | --- | --- | --- | --- | --- | --- | --- |
| No source (Continuous) | 1440 | 154 x 30 | 437.9 | 527.6 | 150 | 0 | 0 |
| Simulator, 60-char name, Continuous idle / acquiring / paused | 1440 | 154 x 30 | 567.9 | 657.6 | 280 (ellipsis) | 0 | 0 |
| Same, Single idle / auto-stopped / averaging / disabled | 1440 | 154 x 30 | 567.9 | 657.6 | 280 | 0 | 0 |
| Simulator, 60-char name, all states | 1024 | 154 x 30 | 552.9 | 633.6 | 280 (ellipsis) | 0 | 0 |
| SA430 `08FF41E50F8B3A34` (real), idle / capturing / done | 1440 | 154 x 30 | 512.5 | 602.2 | 224.6, name not cut | 0 | 0 |
| SA430 real, idle | 1024 | 154 x 30 | 497.5 | 578.2 | 224.6, name not cut | 0 | 0 |

Result: the control is 154 x 30 in every mode and state, at both widths, and nothing else moves
(`expectSameGeometry` in the tour checks width, height, chevron, Center and source positions). The
toolbar does not overflow at 1024 with the real name or with the 60-char name. The design's
"~125px" budget is respected because the source name absorbs the change (280 px max, ellipsis).

## 4. Visual inspection (mandatory): each screenshot looked at

Every PNG below was opened and checked against `design.md` and the prototype. Result: OK unless
noted.

| Screenshot (in `screenshots/`) | State | Finding |
| --- | --- | --- |
| `disabled-no-source-continuous-1440.png` | no source, Continuous, disabled | OK. Dimmed control; hint "No source connected"; source reads "Choose a source". |
| `continuous-idle-1440.png` / `-1024.png` | connected, Continuous idle | OK. Teal, play icon, label, chevron. |
| `single-idle-1440.png` / `-1024.png` | connected, Single, trace held | OK. Purple, dark label. Trace is the held one from before the mode change (HOLD badge). |
| `single-idle-empty-1440.png` | Single, connected, no trace | OK. Badge "Stopped", hint "No trace yet. Press Play for one sweep." (design copy). |
| `continuous-acquiring-1440.png` / `-1024.png` | Continuous acquiring | OK. Pause icon, teal, LIVE. |
| `continuous-acquiring-chevron-locked-1440.png` / `-1024.png` | locked chevron | OK. Chevron dimmed (0.55), no menu. |
| `continuous-paused-hold-1440.png` / `-1024.png` | paused | OK. Play icon, HOLD. Pause is teal, not amber (Q1). |
| `single-auto-stopped-hold-1440.png` / `-1024.png` | Single auto-stopped | OK. Trace held, button idle purple. |
| `single-averaging-4-hold-1440.png` / `-1024.png` | Single with averaging 4 | OK. Status "Avg 1/4". |
| `menu-open-continuous-1440.png` / `-1024.png` | menu, Continuous checked | OK. Inside the window at 1024 (right edge aligned with chevron). |
| `menu-open-single-keyboard-1440.png` / `-1024.png` | menu, Single checked, opened by keyboard | OK. Checkmark on Single. |
| `keyboard-menu-focus-continuous-1440.png` | menu, focus moved to Continuous | OK. Blue 2px ring on the item. |
| `keyboard-focus-chevron-1440.png` | focus on chevron | OK. One ring around the whole control. |
| `keyboard-focus-main-acquiring-1440.png`, `-paused-1440.png` | focus on main, Space/Enter | OK. Focus kept across the change. |
| `disabled-disconnected-single-1440.png` / `-1024.png` | Single, disconnected | OK. Dimmed, label "Single" still shown. |
| `restart-restored-single-disconnected-1440.png` | after restart | OK. Single restored. |
| `sa430-single-idle-1440.png` / `-1024.png` | SA430 real name, single idle | OK. Full name `SA430 08FF41E50F8B3A34` not cut at 1024. Units dBm. |
| `sa430-single-capturing-1440.png` | SA430 capturing | OK. Square Stop icon, CAPTURING badge (purple), "Capturing one sweep…". Chevron locked. |
| `sa430-single-auto-stopped-1440.png` | SA430 after sweep | OK. HOLD, Frame #1, status bar "Unit dBm", axis dBm. No dBFS. |
| `sa430-single-averaging-4-1440.png` | SA430 averaging 4 | OK. "Avg 1/4". |
| `sa430-single-cancelled-1440.png` (pre-fix run) | SA430 after cancel attempt | Pre-fix: showed a frame after the cancel (BUG-1). Superseded by the re-test below. |
| `screenshots/bug1-retest/bug1-cancelled-settled-1024.png` | SA430 after an immediate Cancel, 1024 wide, settled (after fix) | OK. Single idle (purple, "Single"), HOLD badge with the trace from before the cancel, status "Frame #3 · 22:42:21" unchanged by the cancelled sweep, live region announced "Single capture cancelled" (sr-only, not visible, as designed). No overflow; full source name `SA430 08FF41E50F8B3A34` shown. Known and unchanged: Center field 433.920000 MHz vs status bar 433.919 MHz (driver placement, pre-existing). |
| `screenshots/bug1-retest/sa430-single-cancelled-1440.png` (after fix, from the tour) | SA430 after cancel, 1440 wide | OK. Single idle, HOLD, "Frame #1 · 22:42:12": the frame count did not change after the cancel. |
| `e2e/logs/visual/toolbar-acquiring-22-1024-seeded.png`, `toolbar-acquiring-60-1024-seeded.png` (from the e2e run) | simulator, 22- and 60-char names at 1024 | OK. Ellipsis on the 60-char name only. No SIMULATED. |

Visual defects found: none that are caused by this work. Two cosmetic points noted, not filed:
the source button shows the existing teal focus ring after app start (existing behaviour), and the
status bar Center (433.919 MHz) differs from the Center field (433.920000 MHz) on the SA430 because
of the driver's window placement (existing, out of scope).

## 5. Pre-existing e2e failures (visual.e2e.ts, 4 of 23)

Same 4 failures as the developer's HEAD export; none in code changed by 006 (`git diff --stat HEAD -- src/components/source*` is empty):
- "hover actions sit below the badge pill instead of covering it" (known defect, roadmap).
- Three "the source button never showed Bench SA430 analyzer 2" (1180, 1024, 520), failing at the pick of a remembered row (menu stays open after a failing pick). Not a layout failure.

Decision for the PM: fix, or mark skipped with a reason. QA does not block 006 on them, but they must be tracked.

## 6. Open defects

**BUG-1 (medium): a cancelled SA430 single sweep was still shown. STATUS: fixed, verified (section 9).**
Root cause (staff engineer, `bug1-rootcause.md`): the UI dropped the Cancel click in the 10-25 ms
window after the press while the start command was still in flight, so Stop was never sent and the
sweep completed. The backend discard was already correct. Fix: T7 (queued Stop behind an in-flight
start in `src/state/session.ts`; press accepted in `CaptureControl.tsx`; cancelled announcement
suppressed when a newer frame exists). Evidence: section 9.

No open defects after the re-test. Open items (not 006 defects): the 4 `visual.e2e.ts` failures (section 5, PM decision); residual frame-pump race noted in the T7 handoff (a late cancel can announce "cancelled" if the frame reaches the UI after the status; not observed in the re-test, section 9).

## 7. Not run / limits

- Busy (command in flight, aria-disabled main, design state 3/8): not observable in WebKitGTK; not run.
- Capture-failed notice with Restart (design state 12): no real device failure available; covered by Rust tests only (`single_capture_read_error_fails_and_keeps_the_source`).
- Device lost during single capture (state 13): Rust test only.
- Tooltip text: native `title`, not read in the real app; Vitest only.
- Live-region announcements: not read through a screen reader; Vitest checks the text.
- Hardware add-source and visual hardware cases: not run (developer ran sa430 hardware only).
- Mode menu under SA430 was checked at 1440 only (keyboard run and menu screenshots on simulator at both widths).

## 8. Files added by QA (uncommitted, under e2e/)

- `e2e/specs/qa-capture-tour.e2e.ts`: QA tour, off unless `SPECTRUM_QA_TOUR=1` (hardware part also needs `SPECTRUM_E2E_SA430=1`). Writes the screenshots and JSON measurements. It passes on the fixed build (BUG-1 cases included). Its BUG-1 cases (`SPECTRUM_QA_BUG1=1`) are the 12-round immediate-cancel loop and the 5-round Pause-after-Play loop. Staff engineer to decide whether it stays in the repo.
- `e2e/fixtures/seed/qa-capture-tour/sources.json`: seed with the real SA430 and a 60-char simulator name.

## 9. Re-verification after the BUG-1 fix (T7), 2026-11-09

Build: debug build (`npx tauri build --debug --no-bundle`, 22:41) of the working tree with T7,
real SA430 `08FF41E50F8B3A34` on `/dev/ttyACM0`, WebKitWebDriver from the scratchpad on PATH, no
other spectrum-studio process running at the start (none of mine left running at the end).

| Test (row) | Command / spec | Rounds | Result | Evidence |
| --- | --- | --- | --- | --- |
| BUG-1 immediate cancel, tour | `SPECTRUM_QA_TOUR=1 SPECTRUM_E2E_SA430=1 SPECTRUM_QA_BUG1=1 SPECTRUM_QA_BUG1_ROUNDS=12 wdio run e2e/specs/qa-capture-tour.e2e.ts` | 12 | PASS: every round `outcome=clicked`, frame 3 -> 3, announced "Single capture cancelled", back to idle | `screenshots/bug1-retest/bug1-rounds.txt`, `scratchpad/tour-retest1.log` |
| BUG-1 immediate cancel, tour single case | same run, "single capture on the real SA430" | 1 | PASS: frame 1 -> 1, cancel clicked while CAPTURING | `screenshots/bug1-retest/sa430-cancel-timeline.txt` |
| BUG-1 immediate cancel, SA430 spec | `SPECTRUM_E2E_SA430=1 wdio run e2e/specs/sa430.e2e.ts` (run 2 times) | 5 + 5 | PASS 7/7 both runs, the BUG-1 test passes each time (no frame shown after Cancel, announcement "cancelled") | `scratchpad/qa-sa430-rerun1.log`, `scratchpad/qa-sa430-rerun2.log` |
| BUG-1 immediate cancel, full e2e | `SPECTRUM_E2E_SA430=1 npm run e2e` | 5 | PASS (sa430 spec 7/7 in the full run) | `scratchpad/qa-full-e2e.log` |
| Pause pressed immediately after Play, Continuous | tour, "a Pause pressed immediately after Play..." | 5 | PASS: every round `outcome=clicked` (the Pause label was seen and the click was not lost), state Connected, idle, liveness `stopped` (HOLD), frame count unchanged over 1.5 s after the pause | `screenshots/bug1-retest/bug1-pause-rounds.txt` |
| Rust BUG-1 contract | `cargo test -p spectrum-core --test session -- stop_` once, and 15 loops of the two Stop tests | 1 + 15 | PASS 3/3; 0 failures in 15 loops | `scratchpad/qa-rust-stop-1.log` |
| Full checks | `npm run check` | - | PASS, exit 0 (Vitest 259/259) | `scratchpad/check-qa3.log` |
| Full e2e | `SPECTRUM_E2E_SA430=1 npm run e2e` | - | EXIT 1 only from `visual.e2e.ts` (same 4 failures as before, section 5); 10 other specs pass (sa430 7/7, acquisition, persistence, source-row, failures, migration, migration-dup, add-source, edit-source). Qa tour is off in this run (its env not set). Log: `scratchpad/qa-full-e2e.log` | |

Total immediate-cancel rounds on the fixed build: 1 + 12 + 5 + 5 + 5 = 28, all with `outcome=clicked`
(the Cancel label was seen and clicked in the same page task) and no frame shown after Cancel.

Control (pre-fix, same click method): the QA tour runs before the fix (`scratchpad/tour7..tour11.log`)
showed a new frame after Cancel in 4 of 5 runs (1 -> 2, 1 -> 3, 4 -> 5), and the developer's pre-fix
run failed round 1 with "a frame was shown after Cancel (8 -> 9)". So the check distinguishes the
two builds.

Screenshot looked at (ok): `screenshots/bug1-retest/bug1-cancelled-settled-1024.png` (see section 4).
The 1440 cancelled state `screenshots/bug1-retest/sa430-single-cancelled-1440.png`: Single idle, HOLD,
Frame #1, no change after the cancel. Both show no overflow and the full SA430 name.

Findings on the fixed build:
- No defect found in the cancel or pause paths. No frame after a cancel in 28 rounds; no lost click
  in 33 immediate presses (28 cancel + 5 pause).
- Not observed: the residual frame-pump race from the T7 handoff (a late cancel announcing
  "cancelled" while the frame reaches the UI later). The 28 rounds were all true cancels, so this is
  not exercised. Residual risk, low: the announcement may say "cancelled" when a frame does appear
  for a sweep the backend had published before the Stop.
- Not re-run: the stop-while-busy path in the store (second Stop during the queued drain, covered by
  Vitest only); the Pause-after-Play click in Single mode (not in the story's criteria).

Verdict: **ship** for story 006 (capture modes). Conditions: the PM decides the 4 pre-existing
`visual.e2e.ts` failures (fix or skip with a reason, section 5); they are not caused by this work.
