---
id: 0096
from: developer
to: product-manager
type: handoff
subject: T1 core capture mode done (copy)
work: 006-capture-modes
reply-to: 
date: 2026-11-09T21:19:48-03:00
---

T1 (core capture mode) implemented, uncommitted. `npm run check` EXIT 0 (cargo fmt, clippy -D warnings, cargo test --workspace, prettier, eslint, tsc app+e2e, vitest 204 passed).

Diff
- model/session.rs: `CaptureMode { Continuous (default), Single }` (camelCase, ts-rs export); `SessionStatus.capture_mode` always set; `SessionStatus::new(processing, capture_mode)`. model/mod.rs re-exports it.
- session/mod.rs: `with_capture_mode(mode)` and `with_capture_timeout(d)` builders (30 s default const `SINGLE_CAPTURE_TIMEOUT`); `set_capture_mode(mode)` (no worker -> status only; worker -> `Command::SetMode`, serialised with Start, refused while acquiring with "Pause or cancel acquisition to change the capture mode."); `start()` sends `Command::Start(status.capture_mode)`; connect passes mode + timeout to worker.
- session/worker.rs: `Start(mode)`, `SetMode`; single logic: after a sweep is produced, one `try_recv` - Stop/Shutdown seen -> frame dropped (the command is handled next loop turn via `deferred`), otherwise publish, stop source, Connected. No sweep by deadline (checked between reads) -> AcquisitionFailed "Single capture failed: the source produced no sweep in time.". Read error in single -> "Single capture failed: <e>"; continuous copy and fatal/DeviceLost unchanged. Continuous path unchanged.
- tests/session.rs: 12 new tests (SweepDriver: trace/IQ feed, delay, recoverable/fatal fault, read counter).
- src/bindings/CaptureMode.ts (new), src/bindings/SessionStatus.ts (captureMode) via `npm run bindings`.
- src/test/fixtures.ts: added `captureMode: 'continuous'` to the status() fixture (needed for tsc; the only frontend literal).

Tests added (all pass; 15 repeats of the capture tests, no flakes)
- default continuous, kept across connect/disconnect, builder
- rejected while acquiring (state and mode unchanged)
- simulator single: one raw sweep with averaging 8 (averagedCount 1), Connected without Stop, no second sweep, second Start gives new seq
- Acquiring -> Connected reported with mode single
- IQ block 128 with fft 1024: 8 reads, one frame
- trace single: exactly one read
- stop during an in-flight sweep: frame never published, no notice
- recoverable read error: AcquisitionFailed "Single capture failed: Sweep timed out.", source kept
- fatal read error: DeviceLost
- no sweep within timeout (1-sample IQ, 100 ms bound): AcquisitionFailed
- continuous streaming and stop unchanged

Deviations from T1 / ADR 0013 (please decide)
1. No `#[serde(other)]` on `CaptureMode`. On an IPC enum it would silently turn an invalid `set_capture_mode` argument into continuous, against "validate all input at the boundary". Unknown persisted values should instead be handled in T2 at the `Preferences` level (lenient field wrapper). ADR 0013 wording says the enum carries it; this needs an ADR amendment or the T2 approach agreed.
2. The Single-sweep test driver reports `tuning: None` for IQ too (test-only, no session check depends on it).
3. Timeout message does not include the duration (copy kept generic; tests use a short bound).

Not done (out of T1 scope): src-tauri `set_capture_mode` command and `with_capture_mode(prefs)` wiring (T2); docs/sources.md note; SA430 session test (per T1). src-tauri compiles unchanged (no SessionStatus::new callers there).

Files: crates/spectrum-core/src/model/{session,mod}.rs, crates/spectrum-core/src/session/{mod,worker}.rs, crates/spectrum-core/tests/session.rs, src/bindings/{CaptureMode,SessionStatus}.ts, src/test/fixtures.ts
