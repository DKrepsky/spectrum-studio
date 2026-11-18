# 013 QA: source button and capture control in the Measurement group (issue 40)

Tested: uncommitted working tree on `feat/40-measurement-source-capture` (QA changed no application code).
Build: `CARGO_TARGET_DIR=<scratchpad>/qa013-target npx tauri build --debug --no-bundle` (EXIT 0, built from this tree).
The binary is in the session scratchpad, not `target/debug`, so the developer's running dev instance was not overwritten.
Driver: WebKitWebDriver from the session scratchpad (no sudo). Screenshots: `screenshots/` (probe shots) and
`evidence/e2e-raw/` (the visual spec's 120 shots from the full run; 6 of them looked at, see below).

## Verdict

**Ship.** All five acceptance criteria pass in the real app with evidence. No blocking or medium defect in the
moved controls. Three Low findings are for the PM (zoom-only clipping of the capture menu, the capture control scrolling
out of view with Source settings open, and a 1 px DESIGN nit), plus pre-existing observations outside this change.

## Automated results

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run check` | **PASS, EXIT 0** | Log: scratchpad `qa-check-013.log`. cargo fmt, clippy `-D warnings`, `cargo test --workspace` (228 passed, 0 failed, sum of all `test result` lines), Prettier, ESLint `--max-warnings 0`, tsc (app and e2e), Vitest 55 files / 710 tests passed. |
| `npm run e2e` (equivalent run) | **PASS, 11 of 11 spec files, EXIT 0** | Ran `npx wdio run e2e/wdio.conf.ts` with `SPECTRUM_STUDIO_BINARY` = the QA build (same tree, same spec set; `npm run e2e` itself would rebuild into `target/debug` while the dev binary path is in use). Log: scratchpad `qa013-e2e-full.log`. Per spec: acquisition 19 passing; visual 47 passing, 3 skipped (two-analyzer case, the same count the developer reports); add-source 6 passing, 2 skipped; edit-source, failures, migration, migration-dup, persistence, source-row, status-bar all passing; sa430 8 skipped (hardware cases need `SPECTRUM_E2E_SA430=1`, not set); status-bar 5 passing (per worker log). |
| Developer tests reviewed | Behaviour, not render only | `MeasurementPanel.test.tsx` (applied payloads, disabled reasons), `Toolbar.test.tsx` (absence of the controls), `SplitButton.test.tsx` (full-width class and CSS), `acquisition.e2e.ts` "puts the source button first and the capture control last ..." (DOM order and labels; toolbar holds none), "opens the source popover and the capture menu inside the window and the panel, and Escape returns focus to the trigger" (placement inside window and panel, focus on the trigger after Escape). Gap: no e2e for zoomed layouts (see F1). |

## Results per acceptance criterion (issue 40)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | Measurement group: device selector first, capture control last | **PASS** | Real app, 1440 (`idle-1440-seeded.png`, `source-popover-1440-seeded.png`). Measured DOM order of the group's `data-testid`s and labels: `source-button`, `source-button-status`, `source-button-name`, `Center`, `center-frequency`, `Span`, `span-select`, `FFT size`, `Window`, `Averaging`, `Max hold`, `Min hold`, `acquire-button`, `capture-mode-button`, `capture-live-region` (the last is an empty, invisible live region). Visually: device row at top (y 65), capture main + chevron last (y 315). |
| AC2 | Toolbar shows no device selector and no capture control | **PASS** | Real app, 1440 and 1024: toolbar children are only `DIV.brand` ("Spectrum Studio"); `document.querySelectorAll('.toolbar [data-testid]').length` = 0. Toolbar 1440 x 33, brand 121.9 x 18 at x 12 (DESIGN 3.2/3.3: 122 x 18, ok). Screenshots `idle-1440-seeded.png`, `idle-1024-seeded.png`, `min-1024-sim.png`. |
| AC3a | Long device name in the side panel at default width: nothing overflows or overlaps | **PASS** | 60-char name (`Very long source name used to check that truncation is clean`), real app, failed state (no device of that name exists here). Name box 238 px, `scrollWidth` 352, `text-overflow: ellipsis`; button 305 x 30 at x 1123 inside the panel column (1110 to 1440); the title attribute is "Very long source name used to check that truncation is clean\nChoose source (Ctrl+K)" (full name on hover); the accessible name holds the full name. Screenshots `long-60-1440-seeded.png`, `long-60-kb-1440-failed.png` (looked: ellipsis "...t..." reads cleanly, the row does not overlap the status dot or the chevron, Center below is not displaced). 22-char real serial `SA430 08FF41E50F8B3A34` shown in full (`idle-1440-seeded.png`, `button-real-serial-1024-seeded.png` in `e2e-raw`). |
| AC3b | Long Center value (GHz) at default and minimum width | **PASS** | `5.999000000 GHz` in Center (140 x 28): `scrollWidth` 138 = `clientWidth` 138 at 1440 and at 1024 (no clipping). Screenshots `center-ghz-1440-seeded.png` (looked: whole value, unit and caret visible), `center-ghz-1024-sim.png` (looked: fits, focus ring visible). Also at simulated 125%, 150% and 200% (see Q-5). |
| AC3c | Long names and values at the minimum window 1024 x 640 | **PASS** | `min-1024-sim.png` (looked: Measurement group complete, capture control visible under Averaging, status bar intact). Workspace: toolbar 33, plot 345, status bar 24. |
| AC4a | Source popover fully visible from the side panel, mouse | **PASS** | 1440: popover 305 x 457 at x 1123 to 1428, y 99 to 556; panel 1110 to 1440; window 1440 x 900. 1024: popover 707 to 1012, panel 694 to 1024. Popover content is not cramped: long names ellipsise (`Very long source name use...`), the "Seeded long port" path ellipsises, the badge and status line are intact (`source-popover-1440-seeded.png`, `source-popover-1024-seeded.png`, `source-popover-long-1440-seeded.png`, looked). |
| AC4b | Source popover keyboard and focus | **PASS** | Focus ring on the trigger: `outline 2px solid rgb(90,169,255)`, offset 1px, `:focus-visible` true (`focus-source-button-kb-1440-sim.png`, looked). Enter on the trigger opens it and moves focus to the active row (`source-entry-vis-real`). Tab walks the rows' buttons in order (Edit, Forget, next row ...). Escape returns focus to `source-button`. Keyboard pick (Enter on `source-entry-vis-sim`) closes the popover and focuses `source-button` ("Source: Signal simulator, Connected"). Mouse pick also returns focus to `source-button` (P0 probe). |
| AC4c | Capture menu fully visible from the side panel, mouse | **PASS** (zoom-only exception F1) | 1440: menu popover 280 x 133 at x 1148 to 1428, y 349 to 482; right edge aligned to chevron right edge (1428); inside panel and window (`capture-menu-kb-1440-sim.png`, `capture-menu-1440-seeded.png`, looked). 1024: inside panel (`capture-menu-open-1024.png` in e2e-raw, looked). |
| AC4d | Capture menu keyboard and focus | **PASS** | Enter on the chevron opens it (`aria-expanded` true), focus on the checked item (`capture-mode-continuous`); ArrowDown moves to `capture-mode-single`; Enter picks Single: menu closed, focus on `capture-mode-button` ("Capture mode: Single"), main button now "Start single capture". Escape (mouse-opened menu) returns focus to the chevron. |
| AC4e | Tab order sensible | **PASS** | From the toolbar, the first Tab lands on the Measurement heading (`summary`), then `source-button`, `center-frequency`, `span-select`, FFT `select`, Window `select`, Averaging `input`, Max hold, Min hold, Reset, `acquire-button`, `capture-mode-button`, next section's heading. Reading order, no trap. (`focus-source-button-1440-sim.png`: focus ring on the heading.) |
| AC5 | Capture control when the panel scrolls (Source settings open) | **Reported** (behaviour, see F2) | With the simulator connected, Source settings open: side panel `scrollHeight` 2226, `clientHeight` 763 at 1024 x 820. Scrolled to top: capture main at y 315 (visible). Scrolled to bottom: capture main at y -1148 (out of view); the capture control is not sticky, it scrolls with the panel. With no source, the Source settings section is short and the control stays visible at max scroll (y 252, `source-settings-scrolled-1440-seeded.png`). Screenshot `source-settings-scrolled-bottom-1024-sim.png` (looked). |
| AC6 | DESIGN.md, unit and e2e reflect the new layout; `npm run check` passes | **PASS** (numbers, see table below) | `npm run check` EXIT 0; e2e 11/11 files pass; DESIGN numbers re-measured (table below): all match except a 1 px status bar nit (F3). |

## Re-measured DESIGN.md numbers (developer's flagged items included)

Real app, CSS px, `getBoundingClientRect`, simulator connected or a failed source as noted.

| Item | Measured | DESIGN says | Result |
| --- | --- | --- | --- |
| Source button, panel column | 305 x 30 at y 65 (1440); 305 x 30 (1024) | 3.2 305; 9.9 305 x 30 | match |
| Capture main | 279 x 30 | 9.9 279 x 30 | match |
| Capture chevron | 26 x 30 | 4.3 26 | match |
| Center field | 140 x 28 (1440 and 1024) | 9.9 140 x 28; 3.6 140 | match |
| Span select | not measured directly (same inline layout as Center; 012 measured 140 x 28) | 9.9 140 x 28 | not run |
| Source popover | 305 wide; 1440 y 99 to 556 | 4.11 "as wide as the button (305)"; 012 numbers y 99 to 556 | match |
| Capture menu popover | 280 wide, right edge at chevron (1428) | 3.6 and 4.11 "280px, right-aligned to the chevron" | match (the inner `role=menu` is 266 = 280 minus padding and border) |
| Brand | 121.9 x 18 | 3.3 "122px wide", 3.2 | match |
| Toolbar height | 33 (1440 and 1024 and 1024 x 640) | 3.1, 3.2 33 | match |
| Status bar height at 1024 x 640 | **24** (y 616 to 640) | 3.1 and 3.7 "25px measured in 040"; workspace "about 582" | **nit (F3):** 24 measured; the workspace is 583 |
| Spectrum canvas at 1024 x 640 | 694 x 345 | 3.7 "about 345" | match |
| Name box in the source button | 238 px (1440, 1024) | 3.2 "name area 238px" | match |
| Side panel width | 330 (1440, 1024, all zoom levels) | 3.6 330 | match |
| Longest label "Reference level" (91 px in 3.6) | not re-measured | 3.6 | not run |
| Status bar items at 150% and 200% (3.9) | not re-measured (status bar text reduced to one line in the zoom shots; item count not checked) | 3.9 "keeps 7 / keeps 5" | not run |

## Q-5 zoom and the 3.9 rows (simulated root zoom at a 1024 x 820 window; see the caveat)

Method: `document.documentElement.style.zoom = z` at a 1024 px window (the memory note on webview zoom: Ctrl+= does nothing
in this build, media queries are not re-evaluated, the 1180 breakpoint is already on at 1024).

| Zoom (CSS viewport) | Side panel | Source button | Capture | Source popover | Capture menu | Center (value fits) | Name |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.25 (819) | panel 412 screen px = 330 css; scrollWidth 330 = clientWidth 330 | 381.5 screen = 305 css, inside | inside | not measured | not measured | 138 / 139 (1 px rounding) | ellipsis |
| 1.5 (683) | panel 330 css, scroll 330 vs 329 (1 px rounding) | 305 css, inside | 26 css chevron, inside | 305 css, x 548 to 1006 inside panel 529 to 1024; y 149 to 723 | 400 screen px wide, y 569 to 713 inside window (820) | 139 / 139 | ellipsis |
| 2.0 (512) | panel 330 css, scroll 329 vs 329 | 305 css, inside | inside | 305 css, y 115 to 689 inside window | **capture menu y 615 to 883: bottom 63 px below the 820 px window** (F1) | 138 / 138 | ellipsis |

Result for 3.9: the side panel never clips horizontally at 125% / 150% / 200% (its column stays 330 css and its
controls stay inside it). This supports DESIGN 3.9's "side panel intact" for 150% and 200%. The status-bar row was not
re-measured. Q-5 remains "unsupported"; the 2.0 capture menu clipping is recorded as F1 for the PM.

## Findings

| ID | Severity | Finding | Evidence | Suggested owner |
| --- | --- | --- | --- | --- |
| F1 | Low (zoom only; Q-5 unsupported) | At simulated 200% zoom in a 1024 x 820 window, the capture mode menu opens below the chevron and runs 63 px past the bottom of the window (menu y 615 to 883 on a 820 px window). The panel (the scroll box) clips it at its bottom edge, so the "Single" item is not visible in the screenshot; whether scrolling the panel reveals it was not tested. Not reproducible at 100%, 125% or 150%. The source popover at 200% stays inside (y 115 to 689). | `screenshots/capture-menu-zoom-2-1024-sim.png` (looked: the menu is cut at the status bar, the second item is not visible), `screenshots/zoom-2-1024-sim.png`. The acquisition spec checks the menu inside the window only at 1440. | designer / developer if zoom becomes a requirement (Q-5) |
| F2 | Low (design question) | The capture control is not sticky. With Source settings open (a connected source makes it 2226 px tall in a 763 px panel) it scrolls out of view as the panel scrolls, and it is out of view when the user is adjusting Source settings. Its state stays visible in the plot tag and the status bar. Not an acceptance failure (the story asks that it is fully visible from its position, and it is). | `screenshots/source-settings-scrolled-bottom-1024-sim.png` (looked: capture control absent, the Source settings and Peaks rows fill the panel), `screenshots/source-settings-open-top-1024-sim.png`. | PM decision: keep as is, or pin the control (sticky) or move Source settings. |
| F3 | Low (DESIGN nit) | DESIGN 3.1 and 3.7 state the status bar as 25 px tall and the workspace as about 582 px at 640 px high. Measured status bar is 24 px (y 616 to 640), workspace 583 px. | Measured at 1024 x 640 (`min-1024-sim.png`). | designer / developer (edit the numbers) |
| F4 | Low (pre-existing, not changed in 013; candidate issue) | A failed source reads "Failed" with a red mark in the list and on the row, but the source button's accessible name says "Source: <name>, Disconnected". The state suffix uses the session state, not the row's status word. `SourceButton.tsx` changed only in a comment in this work item. | `long-60-kb-1440-failed.png`; probe: `aria-label` "Source: Very long source name used to check that truncation is clean, Disconnected". | PM, as a candidate issue |
| F5 | Low (pre-existing, not changed in 013; candidate issue) | With no source connected (after a failed connect), FFT size, Window and Averaging are enabled and show the last processing values, while Center and Span are disabled with an em dash. The Measurement panel disables the FFT rows only for trace sources. | `long-60-1440-seeded.png` / `long-60-kb-1440-failed.png` (FFT row is in the normal colour). | PM, as a candidate issue |
| F6 | Info (test gap) | The 60-char name exists only as a failing seeded source here, so the long name in a connected state is not measured (the markup is the same; the status dot is the only difference). The zoomed capture menu is not covered by e2e (F1). | Method limitation. | QA note |

No defect blocks merge. The developer's moved controls behave as before (AC4 keyboard and focus, the menus' contents).

## Screenshots (QA probes and visual run; looked at each one listed)

Probe shots in `screenshots/` (this QA session; names `<state>-<width>-<data>`, `seeded` = the visual seed with long names,
`sim` = simulator connected, `kb` = keyboard focus):
- `idle-1440-seeded.png`: ok. Real SA430 connected (real name, 433.92 MHz). Measurement group order correct.
- `idle-1024-seeded.png`: ok (banner from the failed seeded source; the panel starts below it).
- `source-popover-1440-seeded.png`, `source-popover-1024-seeded.png`, `source-popover-long-1440-seeded.png`: ok. Popover inside the panel.
- `source-popover-kb-open-1440-sim.png`: taken, not viewed separately (its measurements are in the probe log).
- `focus-source-button-kb-1440-sim.png`: ok, blue focus ring visible on the trigger.
- `focus-source-button-1440-sim.png`: ok, focus ring on the Measurement heading (first Tab stop).
- `capture-menu-1440-seeded.png`, `capture-menu-kb-1440-sim.png`: ok, menu inside panel, checked item with focus ring.
- `capture-menu-1024-seeded.png`: no menu (no source connected, the chevron is native-disabled, as DESIGN 4.3 says). Expected.
- `center-ghz-1440-seeded.png`, `center-ghz-1024-sim.png`: ok, `5.999000000 GHz` fits.
- `long-60-1440-seeded.png`, `long-60-kb-1440-failed.png`: ok, ellipsis, no overlap (failed source, banner shown).
- `source-settings-scrolled-1440-seeded.png`: ok; `source-settings-scrolled-bottom-1024-sim.png`: F2; `source-settings-open-top-1024-sim.png`: taken, ok.
- `zoom-15-1024-seeded.png`, `zoom-125-1024-seeded.png`: ok (layout intact; text enlarged).
- `zoom-2-1024-sim.png`: ok (side panel and controls fit); `capture-menu-zoom-2-1024-sim.png`: F1.
- `min-1024-sim.png`: ok.
- `source-popover-zoom15-1024-sim.png`, `source-popover-zoom-2-1024-sim.png`, `capture-menu-zoom15-1024-sim.png`, `capture-menu-zoom-2-1024-sim.png`: popovers inside the panel; the 2.0 capture menu is F1.

Visual spec run (`evidence/e2e-raw/`, 120 files; looked at 4 of them):
- `panel-connected-60-1024-seeded.png`: ok (the long source name ellipsises in the Measurement row; Center, Span and the capture control aligned).
- `capture-menu-open-1024.png`: ok (menu inside the panel, Single checked).
- `button-real-serial-1024-seeded.png`: ok (real SA430 name and serial in full; Center 433.92 MHz, real device).
- `capture-focus-keyboard-1024.png`: ok (focus ring on the Continuous main button; the Peaks table below does not move the control; status bar shows `Unit dBFS` for the simulator).
- The other 116 files in `e2e-raw` were not opened one by one by QA; the spec's own assertions cover their geometry.

## Hardware (real SA430 on /dev/ttyACM0, serial 08FF41E50F8B3A34)

- The real device is shown with its real name in the device selector, the popover ("Connected · /dev/ttyACM0") and the plot axis
  (plot axis label `dBm`, the driver's amplitude unit), for the probe and the e2e visual run. The app auto-connected it at launch
  (`spectrum_core::autoconnect`, the seeded entry was the last used source). Real data observed: Center 433.920000 MHz, Span 10 MHz.
- The hardware-only e2e cases (`sa430.e2e.ts`, two-analyzer, "Different device" warning) were not run (`SPECTRUM_E2E_SA430` not set): skipped by the suite, not verified here.

## Environment and side effects (please read)

- At QA start, `spectrum-studio` PID 70673 (the developer's dev instance) held `/dev/ttyACM0` (`fuser`, `ps`). I did not signal or kill it. At the start of my second probe run it was gone (`fuser` showed no holder, `ps` no PID), so I cannot say when it exited or whether it was restarted. Whether it was still running during my first probe run I cannot tell.
- My first probe instance auto-connected the SA430 at launch (see above). That session ended with the spec. If the human's dev instance is relaunched, it may find the device busy until my probes end (none are running now).
- The developer's dev server port 1420 was not used by my runs.
- Probe specs (`e2e/specs/qa013-probe.e2e.ts`) and their seed (`e2e/fixtures/seed/qa013-probe/`) were throwaway and are **deleted**. Failure screenshots of my first probe run (`e2e/logs/QA013-probe-*.png`, gitignored) are **deleted**.
- Leftover (outside the repo, in the session scratchpad, not deleted): `qa013-target/` (build output, about 1 GB), `qa013-*.log`, `qa-check-013.log`, `wkd/` (the WebKitWebDriver copy).
- Evidence kept: `.claude/team/work/013-measurement-source-capture/screenshots/` (probe shots, `e2e-raw/` visual run).
- `git status` shows no new QA files in the repo (only the developer's modified files and the work folder).

## Not run / blocked (honest status)

- Screen reader: not run (no AT in this environment).
- Real Ctrl+=/Ctrl+- webview zoom: not possible in this build (memory note, Q-5); zoom is simulated by root CSS zoom.
- Status-bar items at 150% and 200% (DESIGN 3.9): not re-measured.
- Hardware-gated e2e (`sa430.e2e.ts`, `SPECTRUM_E2E_SA430`): not run.
- Long name in the connected state: no connectable source has a 60-char name here (F6).

## Re-verification (developer fix pass: F1, F3, F4, F5)

Tested: uncommitted tree on `feat/40-measurement-source-capture`, QA build from this tree in a separate target dir
(`CARGO_TARGET_DIR=<scratchpad>/qa013r-target npx tauri build --debug --no-bundle`, EXIT 0). Binary kept at
`<scratchpad>/qa013r-binary`. The developer's dev instance on 1420 was not touched (none was running). The SA430 was free
(no `fuser` holder). Zoom is simulated with root CSS zoom at a 1024 px window, as in Q-5 (not webview zoom).

### Automated

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run check` | **PASS, EXIT 0** | Rust: cargo fmt, clippy `-D warnings`, `cargo test --workspace` 228 passed, 0 failed. Prettier, ESLint `--max-warnings 0`, tsc. Vitest 56 files, 723 tests passed (710 before the fix pass; the new `usePopupFlip.test.tsx` and the F4/F5 tests). Log: `<scratchpad>/qa013r-check.log`. |
| Unit tests for the fix | Behaviour, not render-only | `usePopupFlip.test.tsx`: `shouldFlipUp` pure rule (fits below, flips above, fits neither way stays below, the clipping panel is the box, not only the window); Menu and Popover get `.popover-up` from measured rects; the panel case. |
| e2e, full suite run 1 | **10 of 11 spec files pass; visual 45 pass, 2 FAIL** | `<scratchpad>/qa013r-e2e-full.log`. Failures: "Visual guard ... side panel sections with a live simulator at 1440px" and "... at 1024px": `Maximum peaks` input "did not become interactable" (`visual.e2e.ts` 241/250). The screenshot (`e2e/logs/Visual-guard-...-at-1440px.png`, looked) shows the Peaks section collapsed when the step ran. `showSection()` only scrolls, so the section was closed by something earlier in the run. Not explained. See N2. |
| e2e, visual alone | **PASS, 47 passing, 3 skipped** | `<scratchpad>/qa013r-visual-alone.log`. |
| e2e, full suite run 2 | **PASS, 11 of 11 spec files, EXIT 0** | `<scratchpad>/qa013r-e2e-full-2.log`: acquisition 21, add-source 6 (2 skipped), edit-source 4, failures 3, migration 3, migration-dup 3, persistence 5, sa430 8 skipped (hardware cases need `SPECTRUM_E2E_SA430=1`), source-row 11, status-bar 5, visual 47 (3 skipped). |

### Probe (throwaway spec `e2e/specs/qa013r-probe.e2e.ts`, 9 cases, all pass; deleted from the repo)

Real SA430 (`08FF41E50F8B3A34`, `/dev/ttyACM0`) and the seeded failing source `Very long source name ...` (`/dev/ttyACM6`, does not exist).
Screenshots: `.claude/team/work/013-measurement-source-capture/screenshots/reverify/`.

| Ref | Fix | Check | Result | Evidence |
| --- | --- | --- | --- | --- |
| P6 | F1 | Capture menu at 200% in a 1024 x 820 window, opens upward (`popover-up`); rect top 355, bottom 623; window 820; panel 66 to 772. Inside window and panel. | **PASS** (the 63 px overflow of the earlier QA is gone) | `reverify/capture-menu-zoom2-1024-real.png` (looked: menu above the chevron, all items visible, Continuous checked, no clipping) |
| P6 | F1 | Keyboard at 200%: focus on open = checked item (`capture-mode-continuous`); ArrowDown to `capture-mode-single`; Escape returns focus to `capture-mode-button` | **PASS** | probe log |
| P5 | F1 regression | Capture menu at 100%, 1440 x 900: opens below the chevron (`popover-up` absent), rect 349 to 482, inside panel and window; Escape returns focus to the chevron | **PASS** | `reverify/capture-menu-1440-real.png` (looked: menu below the chevron, unchanged) |
| P7 | F1 regression | Capture menu at 100%, 1024 x 820: below, 349 to 482 | **PASS** | `reverify/capture-menu-1024-real.png` (not viewed; geometry only) |
| P8 | F1 | Capture menu at 150%: stays below (fits), 524 to 723 in the 820 window | **PASS** | `reverify/capture-menu-zoom15-1024-real.png` (looked: fits, no flip) |
| P5 / P6 | F1 regression | Source popover at 100%, 1440: below, 99 to 556, inside panel. At 200%: not flipped (fits neither way), 199 to 773 against a panel bottom of 772 | **PASS with N1** | `reverify/source-popover-1440-real.png` (looked, ok); `reverify/source-popover-zoom2-1024-real.png` (looked: list scrolls inside the popover, the last row is cut at the panel bottom, see N1) |
| P2 | F4 | Failed source (long name): the accessible name reads `Source: Very long source name used to check that truncation is clean, Failed` (was `Disconnected`) | **PASS** | `reverify/failed-60-1440-seeded.png` (looked: red cross, name ellipsised, banner). The "Not detected" case (absent active source) was not run (N3). |
| P3 | F5 | No source connected (failed connect): `#fft-size` and `#window` disabled; `title` and `aria-describedby` text = "Connect a source first"; computed opacity 0.6 (disabled) | **PASS** | `reverify/nosource-1440-failed-seeded.png` (looked: FFT and Window dim, Center and Span show an em dash, banner and "No source connected" tag). The probe also measured the disabled style: `opacity 0.6`, `cursor default`. |
| P4 | F5 | Connecting the built-in Signal simulator re-enables FFT size and Window; title and description empty | **PASS** | `reverify/connected-real-after-nosource-1440-seeded.png` (looked: FFT 4096 and Window Hann at full contrast, Span 2.048 MHz) |
| P4b | F5 (issue 21) | The SA430 (a trace source) keeps FFT size and Window disabled with the trace reason "The source supplies measured traces; no FFT is computed" | **PASS** (expected by the existing rule) | `reverify/connected-real-1440-seeded.png` (looked, via the crop: FFT/Window dimmed; the reason is the trace one) |

Probe notes: the first two probe runs failed in my own cases (P4 used the seeded `source-simulator` id, which is absent when the simulator is remembered; the entry is `source-entry-vis-sim`). P4 then passed. The product did not fail.

### Fix review (git diff)

- F1: `usePopupFlip` is called in `Menu.tsx` and `Popover.tsx`. Both get the same rule. The class is written once on mount in a layout effect and focus is not moved. The rule uses the box of the nearest scrolling/clipping ancestor (the side panel), so the side-panel popups flip correctly. This is the right scope.
- F3: DESIGN 3.1, 3.7 and the 642 line say 24 px status bar and a 583 px workspace at 640 px. Matches the measured 24 px and 583 px. No "25px" left in DESIGN.md.
- F4: `SourceButton` uses `STATUS_TEXT[status]`, the same words as the row. Non-failed states unchanged (`Connecting…` is kept). Side effect in the e2e helper, see N4.
- F5: `processingReason()` in `MeasurementPanel.tsx` gives trace, no-source, connecting and disconnecting reasons. The e2e test `disables FFT size and Window with their reason ...` asserts disabled, title and description. The trace case has a test in `MeasurementPanel.test.tsx`. Matches DESIGN 4.5 and issue 21.

### Findings (re-verification)

| ID | Status | Finding |
| --- | --- | --- |
| F1 | **Fixed, verified** | 200% capture menu clipped by 63 px in the earlier QA. Now opens upward, fully inside the window and the panel (P6). Normal zoom unchanged (P5, P7, P8). |
| F3 | **Fixed, verified** | DESIGN now says 24 px status bar and 583 px workspace. |
| F4 | **Fixed, verified for Failed** | Accessible name says `Failed`. "Not detected" (absent active source) not run. |
| F5 | **Fixed, verified** | No-source: FFT and Window disabled with the reason (title, description, dimmed). Connecting the simulator re-enables them. |
| F2 | **Open, PM decision** (unchanged) | The capture control is not sticky. No change in this pass, as the human asked. |
| N1 | Low (new observation, pre-existing, not from this fix) | At 200% the source popover is taller than the space below and above, so it stays below and scrolls inside itself. Its bottom is 1 px past the panel bottom (773 vs 772) and the last row is cut at the panel edge (`reverify/source-popover-zoom2-1024-real.png`). The popover has its own scrollbar, so the content is reachable. Owner: designer, if zoom becomes a requirement (Q-5). |
| N2 | Low (test flake, unexplained) | Visual spec, run 1 of the full suite: 2 cases failed on the "Maximum peaks" input (Peaks section collapsed). Did not reproduce in the next full run (11 of 11) or the visual spec alone (47 of 47). It happened in one of three runs. Owner: developer (find what closes the section in that run; `showSection()` only scrolls). |
| N3 | Info (not run) | "Not detected" for an active source that was lost: not exercised in this pass. |
| N4 | Low (test helper) | `sessionState()` in `e2e/specs/helpers.ts` parses the suffix of the accessible name only for Disconnected, Connecting, Connected, Acquiring and Disconnecting. With the F4 change, a Failed or Not detected name returns the default "Disconnected". That matches the session, but a spec cannot assert "Failed" through this helper. Owner: developer. |

### Verdict (re-verification)

**Ship the fix pass.** F1, F3, F4 (Failed case) and F5 are fixed and verified in the real app, with the keyboard and focus
checks unchanged. Other popups (the source popover, the capture menu at 100% and 150%) do not regress. The full e2e suite passes on
its second run (11 of 11). F2 remains a PM decision. Open for the PM: N1 (Low), N2 (a one-off flake, not
explained; a rerun passed), N4 (Low helper note), and N3 (not run).

### Environment and cleanup

- Probe spec `e2e/specs/qa013r-probe.e2e.ts` and seed `e2e/fixtures/seed/qa013r-probe/`: deleted from the repo; the spec copies are deleted too. The repo has no QA files (`git status`: only the developer's changes and the work folder).
- Probe failure shots in `e2e/logs/` (`probe2-styles-...`, `QA-013-re-verification-probe-P4-...`): deleted.
- Kept as evidence: `screenshots/reverify/` (10 PNGs, this pass); `e2e/logs/Visual-guard-...-at-1440px.png` and `...-at-1024px.png` (from the N2 failure, gitignored).
- Leftovers outside the repo, in the session scratchpad: `qa013r-binary` (the QA build, one file), `qa013r-shots/` (115 shots of the full run), logs `qa013r-*.log`, `qa013r-compare-fft.png`. The 3.6 GB `qa013r-target/` build dir was deleted. The `wkd/` WebKitWebDriver copy is still there.
- No dev instance was killed or touched.
