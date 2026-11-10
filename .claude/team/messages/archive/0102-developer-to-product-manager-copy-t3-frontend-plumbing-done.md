---
id: 0102
from: developer
to: product-manager
type: handoff
subject: Copy: T3 frontend plumbing done
work: 006-capture-modes
reply-to: 0098
date: 2026-11-09T21:22:18-03:00
---

T3 (frontend plumbing) implemented, uncommitted. Frontend gates green; full npm run check is blocked only by T2 in-progress Rust (see below).

Files (src/ only, no bindings hand-edited)
- src/ipc/commands.ts: api.setCaptureMode(mode) -> invoke set_capture_mode { mode }, returns null.
- src/test/mockApi.ts: apiMock.setCaptureMode.
- src/state/session.ts: BusyOperation adds settingMode; setCaptureMode(mode) uses the command helper (busy settingMode, errors -> commandError/commandErrorFrom). No optimistic local mode change; only receiveStatus updates it.
- src/state/liveness.ts: liveness(state, frame, now, mode) with new kind capturing (label CAPTURING). single + acquiring -> capturing with or without frame (never LIVE, never stale). Continuous and non-acquiring unchanged. mode undefined behaves as continuous. useLiveness(state, frame, mode) passes it through.
- src/components/SpectrumView.tsx: caller passes status.captureMode.
- src/test/fixtures.ts: captureMode continuous (already present from T1).
- Tests: src/state/liveness.test.ts (continuous/single x acquiring/with-frame/without-frame/stale/disconnected/connected matrix), src/state/session.test.ts (settingMode busy while in flight, mode only changes on backend status, rejected change surfaces commandError with settingMode and keeps mode).

Checks
- npm test: 211 passed (211).
- prettier --check (touched dirs), eslint --max-warnings 0, npm run typecheck (app + e2e): all exit 0.
- npm run check: FAILS at check:rust step `cargo fmt --all --check`, in crates/spectrum-core/src/store.rs:104 (lenient_capture_mode signature formatting). That is T2 in-progress work, not touched by me; I did not edit it. Log: scratchpad check.log. Rust clippy/test not reached by the script; re-run after T2 fmt fix.

Deviations / notes for T4
- CSS: liveness-capturing has no rule in app.css yet (only liveness-live, stale/waiting). T4 owns the purple styling via --single tokens.
- SpectrumView live ref still keyed on kind === live, so CAPTURING does not drive the live draw path. Intended.
- Did not build the UI control (T4). Did not commit. Did not touch running app.
