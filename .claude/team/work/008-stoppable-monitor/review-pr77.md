# Review: sa430 PR #77 (issue #76) stoppable Monitor

Verdict: APPROVE. No must-fix items.
Ran in ~/workspace/sa430 on feat/stoppable-monitor: fmt, clippy -D warnings, doc -D warnings, cargo test (all pass),
`cargo check --target x86_64-pc-windows-gnu --all-targets` (ok). cargo-semver-checks is not installed; analysed by hand.

## Must-fix
None.

## Correctness (all OK)
- fd lifetime: `Arc<OwnedFd>` is shared by the monitor and every handle closure, so it closes exactly once, after the last
  holder drops. A handle that outlives the monitor writes to a still-open fd, so there is no fd-reuse hazard. Good design.
- Sticky stop: the eventfd counter is never read, so it stays readable (level-triggered) forever. Stop-before-run, stop
  twice, and restarted `run` after stop all return at once. This is documented on `Monitor::stop_handle`.
- Race stop vs run: `run` builds the udev socket first, then polls; a stop signalled at any earlier point stays readable.
  When both fds are ready, stop is checked first (src/linux/monitor.rs:~39), so shutdown wins over queued events.
  A stop during handler processing is seen at the next poll (after the current `socket.iter()` drain). Fine.
- EINTR: retried in the loop (monitor.rs:~128). Other OS errors return `Err`, no panic. eventfd failure surfaces as
  `Error::Io` from `create_monitor`. `write` failure on signal is ignored (only overflow); acceptable and commented.
- `LinuxMonitor` is `Send` because the udev socket is created inside `run`; it holds only `Arc<OwnedFd>`.
- MSRV 1.74: OwnedFd, finish_non_exhaustive are fine.

## Semver (0.2.1 -> 0.3.0 via `feat:`, or 0.2.2)
- New provided trait method with default body: non-breaking (trait is not sealed; existing impls keep compiling).
- New pub type `MonitorStopHandle`: additive.
- `create_monitor()` -> `Box<dyn Monitor + Send>`: source-compatible for every normal use. `let m: Box<dyn Monitor> =
  create_monitor()?` still coerces (auto-trait drop is an unsizing coercion), and method calls are unaffected. Only
  breaks someone taking `create_monitor` as a `fn() -> Result<Box<dyn Monitor>>` function pointer or generic
  `F: Fn() -> Result<Box<dyn Monitor>>`; negligible. No cargo-semver-checks lint covers it as far as I know. Strictly it is
  a minor-compatible change; for 0.x release-plz `feat:` bumps minor anyway, so any hairline is absorbed. Fine.
- `create_monitor` now returns `Error::Io` on Linux where it previously could not fail; the Result already permitted it.

## Fit for Spectrum Studio phase 2
Good. `SourceDriver::watch(&self, handler)` currently does `create_monitor()?.run(handler)` inline
(crates/spectrum-driver-sa430/src/lib.rs:127). Phase 2 shape: in `watch`, create the monitor, take `stop_handle()`, store it
in a `Mutex<Option<MonitorStopHandle>>` on the driver, then CHECK the shutdown flag, then `run`. Reason: the handle does
not exist before `watch` starts, so a shutdown that arrives earlier would be missed unless the flag is re-checked after
storing. Add a `SourceDriver::stop_watch(&self)` (or similar) that calls the stored handle, and have
`AutoConnect::shutdown` (autoconnect.rs:162) call it for every watchable driver, then join the watcher threads. If
`stop_handle()` is `None` fall back to the current detach behaviour. No API change needed in the lib.

## Pre-existing POLLERR/POLLNVAL/POLLHUP spin: FOLLOW-UP (separate `fix:` PR), not this one
`Wakeup.device = revents != 0` (monitor.rs:~118) and the old code ignored revents entirely, so if the udev socket ever
reports an error condition, poll returns immediately, `socket.iter()` yields nothing, and the loop spins at 100% CPU. That
was true before this PR, so it is not a regression and mixing a behaviour fix into a `feat:` makes the changelog/blame
muddier. It is cheap (treat POLLERR|POLLNVAL|POLLHUP on the device fd as `Err(io::Error)`, with a unit test using a closed
UnixStream peer / `shutdown`) and matters more for a long-lived watcher thread, so ask the human to open it right after
merge; Studio should not block on it. Note `revents != 0` on the stop fd could likewise include errors; there it is
harmless (returns Ok, which is the desired shutdown).

## Should-fix
None.

## Nits
- src/linux/monitor.rs (tests): `stop_fd_of`/`stop_handle_of` helpers clone the Arc just to feed `wait_readable`; fine, but
  the "given_stop_called_twice" test name says "return_stop_immediately" and only asserts `wakeup.stop`; could also assert
  a second wait still returns (sticky). Optional.
- `signal` casts `&one as *const u64`; `std::ptr::addr_of!` or `&raw const` not needed. Ignore.
- README/docs/CLAUDE.md updated; the monitor.rs doc example lacks the non-Linux note but is `no_run`. Fine.
- Consider a one-line mention in the PR body that sticky-stop means a stopped monitor cannot be re-run (create a new one).
