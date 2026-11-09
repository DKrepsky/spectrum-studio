# 005 Use sa430 0.2.1 and drop the direct serialport dependency
Status: accepted (2026-11-09)

As the maintainer, I want the SA430 driver to rely on the `sa430` crate's own settle delay and timeout API,
so that Spectrum Studio has no direct `serialport` dependency while keeping work 004's reliable connect.

## Acceptance criteria
- [ ] Workspace uses `sa430 = "0.2.1"`; `serialport` no longer appears in any spectrum-kit Cargo.toml
      (dependencies or dev-dependencies). It may remain transitively in Cargo.lock via sa430.
- [ ] `SerialBackend::open` uses `SerialPortChannel::with_settle` (or `new` with the 200 ms default) and a thin
      wrapper that calls `SerialPortChannel::set_timeout` for the handshake timeout / deadline cap, then 5 s for sweeps.
- [ ] Behaviour of 004 unchanged: bounded retry (4 attempts, 6 s deadline), same messages, PermissionDenied/NoDevice retried
      (using `SerialErrorKind`), serial mismatch not retried.
- [ ] Unit tests use `sa430::SerialError::new` (test-utils) instead of `serialport::Error`; all 004 tests still pass.
- [ ] `npm run check` green; ignored hardware tests pass on the real SA430 (10 cycles, reboot-then-connect, sweeps).
- [ ] ADR 0012 and docs/sources.md updated (settle now in the lib; no direct serialport dependency).

## Out of scope
- Any behaviour change; sa430 CI/release fixes (separate PR in the lib repo).
