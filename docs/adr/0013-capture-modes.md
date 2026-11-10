# ADR 0013 — Capture modes (single / continuous) owned by the session

Status: accepted (2026-11-09)

## Context

Work item 006 adds a Single capture (one sweep, then stop) next to today's continuous acquisition.
The UI must show only backend state (`SessionStatus`), no source-specific code may leak into the UI
or session, and the auto-stop must work for IQ sources (simulator) and trace sources (SA430).

## Decision

- **`CaptureMode { continuous, single }`** lives in `spectrum-core::model`. It is an app-level
  preference (not per source), default `continuous`, persisted in `preferences.json`
  (`Preferences.captureMode`, `#[serde(default)]`). The enum itself has no `#[serde(other)]`: an
  IPC argument must be rejected when invalid. The persisted field uses a lenient deserialiser
  (`lenient_capture_mode` in `store.rs`) instead, so an unknown stored value loads as `continuous`
  while the rest of `preferences.json` is kept and the file is not reset.
- **The session owns the mode.** `SessionStatus.captureMode` is always present (the selected mode).
  The UI does not get a separate "running mode" field: the backend rejects `set_capture_mode`
  while `Acquiring` (the worker decides, serialised with `Start`), so while acquiring the selected
  mode is the running mode. UI rule: purple stop and CAPTURING badge = `state == acquiring &&
  captureMode == single`. This replaces design.md's suggested nullable `acquisitionMode`.
- **"One complete sweep" is defined by the pipeline, not by a source**: the first `SpectrumFrame`
  the `Pipeline` emits after `Start`. For the simulator (IQ) that is one read of `fft_size`
  samples; for an IQ device with short blocks, the blocks needed to fill one FFT; for the SA430 one
  `read` = one full device sweep (a sweep cannot be interrupted). No change to the `Source` trait.
- **Single = one raw sweep.** `Start` already resets the pipeline, so the first frame has
  `averagedCount == 1` and averaging/holds do not wait for more frames. After publishing that frame
  the worker stops the source and sets `Connected` (same path as Pause). Averaging settings are not
  changed.
- **Cancel** is the existing `stop_acquisition`. In single mode the worker checks for a pending
  Stop after a read returns and drops the frame instead of publishing it, so a partial/just
  finished sweep is never shown after a cancel.
- **No-sweep bound**: a single capture that has produced no frame after 30 s fails with
  `NoticeKind::AcquisitionFailed` ("Single capture failed: ..."), state `Connected`. Read errors in
  single mode use the same copy. The bound is checked between reads (a read returns within the
  source's own timeout).
- **IPC**: new `set_capture_mode(mode)`; `start_acquisition` takes no argument and uses the
  session's mode (the UI cannot start a mode it did not persist). Validation is Rust-side
  (typed enum, state check).

## Consequences

- One additive field on `SessionStatus` and `Preferences`; `npm run bindings`.
- No driver changes. Drivers keep returning one block per `read`.
- A simulator single capture completes in milliseconds, so CAPTURING is barely visible there;
  the SA430 (~1 s) shows it. Tests for the capturing state use unit/mocked status, not timing.
- Alternatives rejected: per-source mode (no use case, more state); a `Source::read_sweep` trait
  method (every source already yields one block per read, pipeline defines completeness);
  UI-side timer for auto-stop (forbidden by the story).
