# 006 Capture modes: plan

Status: plan for PM. Decision record: `docs/adr/0013-capture-modes.md`. Inputs: `story.md`,
`design.md` (approved), `prototype/index.html`.

## 1. Feasibility (verified against the code)

- **Worker** (`crates/spectrum-core/src/session/worker.rs`): one thread per source; `acquire_once`
  reads, runs the `Pipeline`, `publish_frame`s. Commands (Start/Stop/...) are handled between reads.
  Pause = `Command::Stop` -> `source.stop()` -> `Connected`. Auto-stop slots in right after the first
  published frame; no UI timer, no `Source` trait change.
- **"One complete sweep" per source**: defined by the pipeline (first `SpectrumFrame` after Start).
  Simulator (IQ): the first `read(fft_size)` yields one frame (`discontinuity` is set on start so no
  stale samples; no pacing wait for the first block), i.e. milliseconds. SA430 (trace): one `read` =
  one `device.measure` = full sweep, <= 800 points ~ 1 s, uninterruptible (5 s read timeout).
  Generic IQ devices: blocks accumulate in `push_iq` until `fft_size` samples. All device-agnostic.
- **Averaging**: `Worker::start` calls `pipeline.reset()`, so the first frame has `averagedCount 1`
  and the live trace is the raw sweep. "Exactly one raw sweep" holds with no new code. Note it also
  resets max/min hold on every start (today's Play does too). This contradicts design.md 9.4
  ("holds not reset"): decision below (PM).
- **Persistence**: `store.rs` `Preferences` (schema v unchanged, serde default). Needs `#[serde(other)]`
  for bad values so a corrupt mode degrades to `continuous` without discarding the file.
- **Cancel semantics**: a read in flight cannot be interrupted (SA430 up to ~1 s). Today a sweep that
  completes right after Stop was requested is still published (the Stop is only seen next loop). For
  single the worker must discard it (human decision), see T1.
- **Frame vs status ordering**: the frame is published before the state flips to `Connected`, but the
  UI long-polls frames separately, so for a few ms the UI can see `connected` before the frame
  arrives (badge `Stopped`, then `HOLD`). Acceptable; the completion announcement must key on
  "state left acquiring in single mode", not on the frame.

## 2. Approach

Backend (T1, T2)
- `model/session.rs`: `CaptureMode` enum (`continuous` default, `single`, `#[serde(other)]` on
  continuous, ts-rs export) and `SessionStatus.capture_mode: CaptureMode` (selected mode, always set).
  `SessionStatus::new(processing, capture_mode)`.
- `session/mod.rs`: `SessionManager::with_capture_mode(mode)` builder (avoids touching every
  `SessionManager::new` caller), `set_capture_mode(mode)` (works with or without a worker; with a
  worker it goes through `Command::SetMode` so it is serialised with Start and rejected with
  `SessionError::Invalid("Pause or cancel acquisition to change the capture mode.")` while
  acquiring). `start()` sends `Command::Start(mode, reply)`.
- `session/worker.rs`: `Worker.mode`; single logic: after a frame is produced -> publish, `stop_acquisition`,
  `set_state(Connected)`. Stash a command seen by a post-read `try_recv` so none is lost; if it is
  Stop/Shutdown in single mode, drop the frame. Deadline (`SINGLE_CAPTURE_TIMEOUT` 30 s, overridable
  for tests through the manager builder) -> `AcquisitionFailed` "Single capture failed: ...". Read
  errors in single mode also use "Single capture failed: <error>"; fatal errors unchanged (DeviceLost).
- `store.rs`: `Preferences.capture_mode` (+ test: default, round trip, unknown value).
- `src-tauri`: `set_capture_mode` command (calls session, then `update_preferences`; like
  `set_processing`, a persist failure is reported after the change applied), register it, build
  `SessionManager` with `.with_capture_mode(prefs.capture_mode)` in `lib.rs`.
- `npm run bindings` after T1 (status) and T2 (preferences); commit generated files.

Frontend (T3, T4)
- `ipc/commands.ts` `setCaptureMode`; `state/session.ts` `setCaptureMode` with busy op `'settingMode'`
  (reuses the `command` helper); fixtures/mocks get `captureMode: 'continuous'`.
- `state/liveness.ts` mode-aware: single + acquiring -> `capturing` kind, label `CAPTURING`, never
  stale/`LIVE`; continuous unchanged (design 5.1).
- New `components/capture/CaptureControl.tsx` (split button, group role, one outer focus ring via
  `:has(:focus-visible)`), `CaptureModeMenu.tsx` (menuitemradio, reuse `useMenuKeys`, anchored right),
  `styles/capture.css`, tokens `--single`, `--single-strong`, `--single-ink` in `app.css`.
  Fixed widths 128/26 px, icons Play/Pause/Stop inline SVG, copy table from design.md 6.
  Keep `data-testid="acquire-button"` on the main button (+ `data-mode`), add `capture-mode-button`,
  `capture-mode-menu`. Remove the SIMULATED badge, `.badge.simulated` css and its tests; drop amber
  `.primary.stop`. Update empty hints (SpectrumView/StatusBar) per design copy table; aria-live region
  for "Single capture complete/cancelled" (transition-driven, from status only).
- No device names anywhere in these files.

Tests / docs (T5)
- e2e (simulator, sa430 spec if hardware gated as today), docs, roadmap, visual QA.

## 3. Boundaries and validation

- Mode validated in Rust twice: typed enum on IPC; state check in the worker. Unknown persisted
  value -> `continuous`. UI never sends a mode while acquiring (locked), backend rejects anyway.
- No new dependencies. No change to `Source`/driver crates (docs/sources.md gets one paragraph:
  "a sweep is one `read` for trace sources").

## 4. Risks

1. **Simulator single capture is near-instant**, so `CAPTURING` cannot be asserted in e2e on the
   simulator; cover it with Vitest (mock status) and Rust tests; QA shoots the capturing state from
   mocked status / SA430 hardware. The prototype's 2.6 s sweep is illustration only.
2. **Cancel race**: Stop pressed as the sweep finishes: either outcome is valid (discarded, or
   completed first and the Stop is a no-op). Test asserts both are consistent with state.
3. **SA430 cancel latency** up to the in-flight sweep (~1 s, `COMMAND_TIMEOUT` 10 s ok). Tooltip
   "Cancel capture..." with cursor progress covers it.
4. **Holds reset** on Start (see PM decision A).
5. **Width**: toolbar +125 px. Prototype measured with fallback font; QA must re-measure in WebKitGTK
   (1024 px: `SA430 08FF41E50F8B3A34`, 60-char name, simulator). Existing e2e visual guard
   (`visual.e2e.ts`, toolbar/side panel fit) must be extended with the new control; the source button
   min/max width assertion (150-280 px) may need adjusting (it shares the flex group).
6. `NoticeBanner` Restart uses `start()` -> runs current mode, no change needed.
7. Menu left open when a start comes from the banner: close on `status.state` change (design Q7).

## 5. Test plan

Rust (`spectrum-core`, `tests/session.rs`, store tests, SA430 `tests/session.rs`)
- default mode `continuous`; `set_capture_mode` while connected/disconnected updates status;
  rejected while acquiring (state unchanged).
- Single on simulator: exactly one frame (`seq` +1, `averagedCount 1` with averaging 8), state ends
  `Connected` without a Stop, a second Start gives a new frame; continuous still streams.
- Single with a scripted slow/blocked IQ source that needs several reads: one frame, then stop.
- Single + trace source (scripted, and SA430 `tests/session.rs`): one sweep then `Connected`.
- Cancel before the frame: no frame published, `Connected`. Scripted read error in single ->
  `AcquisitionFailed` with "Single capture failed"; no-frame timeout (short test timeout) same.
- Fatal read error in single still `DeviceLost`.
- Store: `captureMode` default, round trip, unknown value -> continuous, file otherwise valid.
- Bindings regenerated and committed; `npm run check`.

Frontend (Vitest)
- `liveness` single/continuous matrix; `CaptureControl`: names/titles/labels for all states in
  design 5, disabled while disconnected/connecting, aria-disabled while busy and while acquiring
  (chevron), click -> start/stop/setCaptureMode calls, menu keyboard (Down/Up/Home/End/Enter/Esc/Tab,
  focus return), menu closes on state change, live region text, no `SIMULATED`; `Toolbar.test.tsx`
  updated; `session.test.ts` setCaptureMode busy/error; CSS test pattern (`source.css.test.ts`) for
  fixed widths if cheap.

e2e (simulator, real app)
- default Continuous persisted across restart after choosing Single (persistence spec); Single:
  press -> `acquire-button` returns to idle (`data-state="idle"`), a frame exists (status bar shows
  data, liveness `stopped`/HOLD), session state `Connected`; press again -> a newer frame; menu
  keyboard; control disabled with no source; SIMULATED badge absent; chevron aria-disabled while
  Continuous acquiring. Existing helpers using `acquire-button` keep working.
- sa430 spec (hardware-gated as the others): single capture yields one sweep and stops.

Visual QA (QA agent, T6): WebDriver screenshots of both modes in idle/acquiring/disabled/menu-open at
1440 and 1024 with Read; WebKitGTK real-font toolbar width re-measure (cases in risk 5); contrast
spot-check of purple states; keyboard focus ring on the whole control; compare to prototype.

## 6. PM decisions

A. Holds: single/continuous Start resets max/min hold as today (cheapest, consistent). Design 9.4 said
   "not reset". Recommend accept the existing behaviour and amend design.md wording; otherwise
   +1 task (pipeline must keep holds across starts, changes Continuous behaviour too).
B. ADR deviates from design 9.2: one `captureMode` field instead of `captureMode` + nullable
   `acquisitionMode` (equivalent because the backend locks the mode while acquiring). Confirm.
C. 30 s no-sweep bound (backend constant). Confirm or change.
D. Live-region scope (design Q6): complete/cancelled/failure. Included in T4; confirm.
