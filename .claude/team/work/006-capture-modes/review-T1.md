# Review T1 (core capture mode): APPROVED

Scope: model/session.rs, model/mod.rs, session/mod.rs, session/worker.rs, tests/session.rs, bindings.
Ran `cargo test -p spectrum-core` (94 unit + integration all pass); tests/session.rs run 5x, stable (0.42 s each).

## Checked
- Single auto-stop: sweep -> one `try_recv` -> publish -> `stop_acquisition` -> Connected. Averaging is naturally 1 after `pipeline.reset()` (test asserts it with averaging 8). Stop failure on source.stop reports AcquisitionFailed. OK.
- Cancel race: Stop/Shutdown seen right after the sweep is read drops the frame and is handled next turn via `deferred`; other commands read there are also deferred, not lost. Stop arriving after that try_recv yields a published frame then a no-op Stop (acquiring already false) -> Connected, no notice. This residual window is inherent and acceptable; no deadlock, state consistent.
- Timeout: deadline set in `start`, cleared in `stop_acquisition`, checked only on reads returning no sweep; relies on the existing <=250 ms read contract. A source that returns a sweep late still succeeds. Message matches the plan. OK.
- Read errors: single -> "Single capture failed: ..."; fatal/DeviceLost path and continuous message untouched. Continuous path unchanged (`stop_during_a_continuous_capture_is_unchanged`).
- set_capture_mode: serialised through the worker (no race with Start), refused while acquiring with the exact plan message; no worker -> status only; worker that died -> selection kept. `request_locked` refactor is behaviour-preserving.
- Device-agnostic: no driver/device names in core logic; `Source` trait and drivers untouched; test source is generic (trace/IQ feeds).
- Tests: scripted `SweepDriver` covers trace, IQ-fill, cancel, recoverable and fatal errors, timeout. Timing margins are generous (50 ms vs 300 ms read; 100 ms timeout vs 20 ms reads); no flakiness seen.

## serde(other)
Confirmed omitted: serde `#[serde(other)]` would silently map unknown values to a variant (and does not apply to the camelCase status path anyway). Acceptable only if T2 makes `Preferences` load tolerant of an unknown/invalid `captureMode` (fall back to Continuous, keep other prefs, do not fail the whole file) and has a test for it. Review T2 for that.

## Nits (non-blocking)
- `SessionStatus::capture_mode` doc fine; consider noting in docs/architecture or ADR 0013 the residual Stop-after-sweep window (stop returns Ok, frame kept).
