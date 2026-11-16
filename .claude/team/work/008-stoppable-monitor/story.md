# 008 Stoppable sa430 device watcher
Status: accepted (2026-11-16)

As the maintainer of Spectrum Studio, I want the sa430 `Monitor` to be stoppable from another thread, so that the
auto-connect watcher (work 007, ADR 0014) shuts down cleanly on exit instead of being left detached.

## Decisions from the human (2026-11-16)
- Fix in the sa430 lib (DKrepsky/sa430, ~/workspace/sa430) via its workflow: GitHub issue (feature template) → feature
  branch → PR with `Closes #N`, Conventional Commit `feat:`. The human merges the PR and the release PR.
- API: a stop handle — `monitor.stop_handle()` returns a `Send + Sync + Clone` handle; `stop()` wakes the blocking
  `run` (eventfd/pipe in the same `poll`), which returns `Ok(())` promptly. Additive, no new dependencies.
- Spectrum Studio adopts it after release (phase 2, same work item).

## Acceptance criteria — phase 1 (lib)
- [ ] `stop()` from another thread makes a blocked `run` return `Ok(())` promptly (well under 1 s) with no device event.
- [ ] `stop()` before `run` starts makes `run` return immediately; calling `stop()` twice is harmless.
- [ ] Device events still reach the handler; `ControlFlow::Break` still stops `run`.
- [ ] No panic on OS errors; no new dependency; non-Linux targets still compile (`create_monitor` stays Unsupported
      there, the handle API compiles on all platforms).
- [ ] Unit tests for the wake logic (hardware-free); docs/README/example updated; CI checks pass locally
      (fmt, clippy -D warnings, test, doc, windows target check).
- [ ] Issue and PR exist and are linked; nothing merged, no version/changelog edits.

## Phase 2 (after release) — Spectrum Studio
- Bump sa430, call stop on `AutoConnect::shutdown`, join the watcher thread, update ADR 0014 and drop the
  roadmap limitation.

## Out of scope
- Non-Linux monitor implementations.

## Progress
- 2026-11-16: issue DKrepsky/sa430#76, PR #77 (`feat/stoppable-monitor`), CI green, staff-engineer approved
  (review-pr77.md). Waiting for the human to merge #77 and the release PR.
- 2026-11-16: POLLERR/POLLNVAL/POLLHUP spin fix: issue #78, PR #79 (`fix/monitor-poll-error-spin`, stacked on #77). PM reviewed diff.

## Acceptance criteria — phase 2 (Spectrum Studio, sa430 0.2.2)
- [ ] `sa430` bumped to 0.2.2 (Cargo.toml/Cargo.lock only; no other new deps).
- [ ] `AutoConnect::shutdown` stops every watcher that supports stopping and joins its thread promptly (< 1 s) on
      app exit, before `session.disconnect()`; drivers without a stop handle keep the detached behaviour.
- [ ] Device-agnostic: core only sees a generic stop capability; SA430 specifics stay in the driver crate.
- [ ] No race: a stop requested before the driver's watch has created its monitor still stops it.
- [ ] A watcher error (e.g. udev socket failure, #79) ends that watcher thread with a log line, no crash, no spin.
- [ ] Tests with fake watchers (stop during watch, stop before watch starts, join); real-SA430 check that the app
      exits cleanly with the watcher running; `npm run check` green.
- [ ] ADR 0014 updated; roadmap "watcher thread cannot be woken" limitation removed.
