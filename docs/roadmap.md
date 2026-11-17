# Status and roadmap

Status as of 2026-11-16 (version 0.1.0). "Done" means implemented, tested and verified in the
running application.

## Initial delivery

| # | Capability | Status | Verified by |
| --- | --- | --- | --- |
| 1 | Launch on Linux | Done | E2E (all specs), manual |
| 2 | Select and connect the built-in simulator | Done | E2E `acquisition`, session tests |
| 3 | Continuously updating spectrum from simulated IQ | Done | E2E, pipeline/estimator tests |
| 4 | Change frequency and processing settings | Done | E2E (centre, FFT, window), session tests |
| 5 | Peaks and basic analysis tools (markers, peak table, holds, averaging) | Done | E2E, DSP tests |
| 6 | Waterfall of changing signals | Done | Manual/screenshot, time-scale unit test |
| 7 | Start, stop (Play/Pause toggle, trace frozen on pause), disconnect | Done | E2E `acquisition` (incl. keyboard focus), session tests |
| 8 | Manage and save source configurations | Done (reworked: automatic memory, see below) | E2E `persistence`, store tests |
| 9 | Export spectrum data to CSV | Removed (ADR 0011) | — |
| 10 | Preferences retained after restart | Done | E2E `persistence`, store tests |
| — | IQ recordings (SigMF, raw) and CSV traces | Removed (ADR 0011) | — |
| — | Failure handling (connect failure, device loss, read error) | Done | E2E `failures`, session tests |
| — | TI SA430 hardware source | Done | Session tests with mock link, ignored real-device test |
| — | One-step source journey: pick a source to connect, sources remembered automatically (supersedes #8 and the Sources dialog), hidden planned drivers, v1 `sources.json` migration | Done | E2E `acquisition`/`failures`/`persistence`/`migration` (seeded `sources.json`), Rust store/session tests, Vitest menu tests; E2E `sa430` passed once with a real SA430 on 2026-10-31 |
| — | Source journey rework: status circles, fixed name/badge columns, one Add/Edit source dialog with *Test connection*, stable device identity (one row per physical device, rename survives replug), `sources.json` v3 with migration, merge of duplicates and backup | Done | E2E `add-source`, `edit-source`, `migration-dup`, `migration`, `persistence`, `visual` (real-pixel layout guard and screenshots), `sa430` (real SA430, `SPECTRUM_E2E_SA430=1`); Rust store/session/driver tests; Vitest menu/dialog/CSS-contract tests |
| — | Reliable SA430 connect after plug-in: 200 ms settle after opening the port, bounded handshake retry (4 attempts, 6 s deadline), ADR 0012; settle and timeout from `sa430` 0.2.1, no direct `serialport` dependency | Done | Driver unit + session tests (scripted link), ignored hardware tests (10 cycles, reboot-then-connect, sweeps), real-app QA 10/10 + human replug on 2026-11-09 |
| — | `.deb` and AppImage packages | Done | `npm run tauri build` |
| 006 | Single-shot and continuous capture modes: one capture control with a mode menu, single capture stops by itself after one sweep, mode remembered, SIMULATED badge removed | Done (accepted 2026-11-10) | Rust session/store tests, Vitest capture control and toolbar tests, E2E `acquisition`, `persistence`, `sa430` (real SA430, 6/6 with `SPECTRUM_E2E_SA430=1`); E2E `visual` and `source-row` have 5 failing checks that fail the same way on HEAD (see Known limitations) |
| 007 | Auto-connect: connect the first device found at launch and when an SA430 is plugged in while nothing is connected (connect only, paused, never replaces a source, no retry loop; ADR 0014) | Done (accepted 2026-11-16) | Rust core tests (`autoconnect.rs`, session guards), SA430 driver and session tests with scripted watch events, `tests/hardware.rs` reboot cycles; manual on a real SA430 2026-11-16: launch auto-connect (paused, toolbar shows device, screenshot), 3 reboot cycles with relaunch auto-connect; QA re-enumeration while idle, failed launch, manual disconnect, simulator never replaced; human physical unplug/replug (paused and acquiring) 2026-11-16; E2E `sa430` (launch auto-connect, manual disconnect stays down) passed with a real SA430 |
| 008 | Stoppable device watcher: sa430 0.2.2 (`MonitorStopHandle`, udev socket errors no longer spin); auto-connect stops and joins watcher threads on exit (bounded 1 s) | Done (2026-11-16) | Core autoconnect stop/join tests, SA430 driver stop and race tests; real SA430: exit with watcher running joins in < 10 ms, plug-in auto-connect re-verified after the seam change |
| 009 | Design system: `DESIGN.md` at the repo root (1.0-draft.4), one token file (`src/styles/tokens.css`) with token tests, presentational components in `src/ui/` with the ui/feature boundary guard (ADR 0015), canvas reads the tokens, fixes F0 to F17 (status bar keeps `Uncalibrated` at every width), source popover semantics (B1), live-region policy (B2), ARIA clean-up (B7), copy "press Continuous" / "press Single" | Done (accepted 2026-11-17) | Vitest: token (colour, px sizes, Appendix A, contrast), boundary, cssImport and component tests; full E2E incl. `visual` before/after and `status-bar` at 1440/1257/1180/1024; real SA430 run; docs images re-shot; zoom unsupported (Q-5) |

## Known limitations

- Open (007): e2e no-hardware launch branches written but not yet run without an SA430 attached; two devices at launch untested.
- The only real hardware integration is the TI SA430; SoapySDR, rtl_tcp, SCPI-over-LAN and tinySA
  are listed as planned.
- Planned drivers (SoapySDR, rtl_tcp, SCPI-over-LAN, tinySA) are hidden in the UI, not listed as unavailable; they are still tracked here and registered as `Planned`.
- Source journey, not verified by hand: unplugging a real SA430 during a run (the simulator device-loss path is covered by E2E), replugging it into another port and the *different device on the stored port* warning of the Edit dialog (needs two analyzers; E2E marks it skipped), and a `sources.json` with an unknown future version.
- Open (BUG-2): unknown JSON fields in `sources.json` are not preserved when the file is rewritten, and names over 80 characters from a v1 file are truncated. The v3 upgrade keeps a backup of the old file (`sources.pre-v3-*.json`), so nothing is lost for good.
- Open: a `sources.json` with a *newer* `version` than this build is accepted without a warning and overwritten as version 3 on the next change (fields this build does not know are dropped). Follow-up: refuse to overwrite, or back up, files from a newer schema.
- Open E2E: the source-row hover reveal ("hover actions replace the badge", sa430 "renames it through Edit") fails occasionally and passes on rerun; the earlier ArrowRight focus red was fixed in 009 (window focus via `wmctrl`). No retries are added.
- Open (006): a single-capture cancel that arrives just after the sweep was published keeps the trace (correct) but the screen-reader text may say "cancelled" when the frame reaches the UI after the status; closing it needs a backend completed-capture signal.
- Open (006, test hygiene): the SA430 unplug Rust test `unplugging_the_analyzer_disconnects_the_session` failed once under heavy CPU load; the Rust single-cancel test uses a 50 ms head start. Make both deterministic.
- The E2E layout guard cannot shrink the window below the 1024 px minimum, so the popover's `max-width: calc(100vw - 16px)` rule is covered only by the CSS contract test, not in real pixels.
- SA430: no RBW readout, sweeps limited to 800 points and not interruptible (see `sources.md`). A
  single capture on the SA430 can take up to one sweep (about 1 s) to stop after Cancel.
- No amplitude calibration: IQ spectra are dBFS only.
- One spectrum per frame from the newest samples (no overlapped Welch averaging within a block);
  the frame rate is capped at 30 fps by the simulator.
- Peak detection reports every distinct local maximum, so modulated signals can contribute several
  peaks (e.g. FM sidebands); there is no minimum-separation setting yet.
- Plot colours use a fixed dark theme.

## Backlog (from work 009)

Decided by the PM in work 009 (`.claude/team/work/009-design-system/decisions.md`); each is a separate work item.

- **B3 Start-up states.** "Choose a source" is shown before the backend has answered; show "Loading…" until the first status and list arrive, and "Status unavailable" when the start-up command fails (`DESIGN.md` 5.2, S0 and S12). Needs a small store flag.
- **B4 Readout tables by keyboard.** The marker and peak id cells are keyboard buttons; a selected peak is cleared when it is no longer in the frame (`DESIGN.md` 5.3).
- **B5 Peak table cap.** The peak table body is capped at eight rows and scrolls inside (`DESIGN.md` 3.6, 7.4).
- **B6 / Q-20 Notice stack cap.** The stack is capped at 96px and scrolls inside (`DESIGN.md` 3.5).
- **B8 Connecting copy (bug).** While connecting or disconnecting, the plot tag and the status bar say "Connecting…" / "Disconnecting…", not "No source connected" (`DESIGN.md` 8.2).
- **Q-22 Switching source while acquiring.** Option B: the other rows are unavailable while acquiring, with the reason shown. Done together with B3 and B8. Today the switch stops the acquisition with no notice (`DESIGN.md` 5.2.6).
- **Q-7 Peak click.** Split "select peak" from "place marker" (`DESIGN.md` 5.3). Behaviour change: kept as it is in 009.
- **Q-8 Keyboard use of the plot.** Marker movement and zoom keys (`DESIGN.md` 6.10).
- **Q-9 Trace line styles.** Dashed max hold and dotted min hold, so the traces differ without colour (`DESIGN.md` 6.4). Changes the canvas.
- **Q-10 Waterfall colour strip.** A thin colour scale with the range at its ends (`DESIGN.md` 6.9).
- **Q-11 Stale threshold (bug candidate).** A fixed 2 s stale threshold is wrong for slow sweeps. Design: an optional `sweepIntervalMs` in `FrameHeader`, set by the pipeline from the source (SA430: the driver's measured sweep time; simulator: the pacer period); `liveness.ts` uses `max(2000, 3 x sweepIntervalMs)`. Needs bindings and a Rust test (`DESIGN.md` 7.6, `plan.md` section 9).
- **Q-12 Cancel a connect.** Deferred (`DESIGN.md` 5.2.5).
- **Q-5 Zoom support.** Not a requirement in 009; the webview's zoom is unsupported. Needs a decision on a second toolbar row below 780 CSS px and the status bar at 150% and 200% text sizes (`DESIGN.md` 3.9).
- **Q-21 Waterfall auto-hide.** Hide the waterfall below 240px plot height, keeping the user's setting (`DESIGN.md` 3.7).
- **P12 Stale readouts (measurement honesty, prioritise).** Marker and peak tables keep the last values while the plot says "No data for N s"; show "Last data hh:mm:ss" in their section header when not live (`DESIGN.md` 6.8).
- **P11 One frequency unit per axis.** An axis crossing 1 GHz can mix `999.5 MHz` and `1.0000 GHz`; choose one unit from the span (`DESIGN.md` 6.5).
- **P13 Over-range indicator.** Edge markers when a trace runs above or below the displayed range (`DESIGN.md` 6.12).
- **Custom tooltip.** Replaces the native `title` tooltips (`DESIGN.md` 5.4, Deferred).
- **Later items found in 009.** FFT and Window disabled for measured traces show their reason only as a title (`DESIGN.md` 4.5 wants visible text); "Maximum peaks" has no visible label; the required mark on a field label is not in the danger colour (a `ReactNode` label on `Field`); the fixed blocks of the source popover have no visible heading (`DESIGN.md` 4.11, Deferred); the pre-existing red and flaky E2E tests listed under Known limitations.

## Next steps (suggested order)

1. Next hardware: SoapySDR (RTL-SDR, HackRF, Airspy) or rtl_tcp (pure network protocol, no native deps).
2. Gain/AGC and PPM correction as SDR `ParamSpec`s; DC-spike handling.
3. Optional calibration profile (offset table) to turn dBFS into dBm, with clear labelling.
4. SCPI analyzer driver (trace sources, dBm) using a mock TCP server in tests.
5. Channel power / occupied bandwidth measurements; marker noise density (dBm/Hz).
6. IQ recording from live sources (SigMF writer). On hold: file functionality was removed, see ADR 0011.
7. Minimum peak separation, peak tracking across frames.
8. Light theme and keyboard shortcuts.
