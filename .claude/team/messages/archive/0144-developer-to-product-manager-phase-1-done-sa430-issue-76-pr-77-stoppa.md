---
id: 0144
from: developer
to: product-manager
type: handoff
subject: Phase 1 done: sa430 issue #76, PR #77 (stoppable Monitor)
work: 008-stoppable-monitor
reply-to: 
date: 2026-11-16T05:33:09-03:00
---

Phase 1 (sa430 library) is done. Issue and PR are open; nothing merged, no version or CHANGELOG edits.

- Issue: https://github.com/DKrepsky/sa430/issues/76 ("Make Monitor stoppable from another thread")
- PR: https://github.com/DKrepsky/sa430/pull/77 (branch `feat/stoppable-monitor`, commit 4884a69, `feat:`, `Closes #76`)
- Repo state: ~/workspace/sa430 is on `feat/stoppable-monitor`. The old `ci-macos-runner` branch was left alone. Main was fast-forwarded to 5913a13 before branching.

API:
- `Monitor::stop_handle(&self) -> Option<MonitorStopHandle>` is a provided method returning `None` by default.
- `MonitorStopHandle` is `Send + Sync + Clone`, with `stop()` and a public `MonitorStopHandle::new(closure)`.
- Linux: an eventfd sits in the same poll set as the udev socket, and `stop()` writes to it. `run` returns `Ok(())` promptly with no event and no handler call.
- Stop is sticky: once stopped, later `run` calls return at once. Stop before `run` also works.
- `create_monitor()` now returns `Box<dyn Monitor + Send>`. This is needed to move the monitor to a worker thread. Existing `Box<dyn Monitor>` bindings still compile.

Design choice for the trait: a provided method, not a required one. A required method would break external implementors. `Option` lets a monitor that cannot be woken say so, rather than return a handle that does nothing.

Checks (all green on the branch):
- `cargo fmt -- --check`: ok
- `cargo clippy --all-targets --all-features -- -D warnings`: ok
- `cargo test --all-targets`: 99 lib + 10 + 7 + 8 (1 ignored, pre-existing), all pass
- `cargo test --doc`: pass, including a new stop-from-another-thread example
- `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps`: ok
- `cargo check --target x86_64-pc-windows-gnu --all-targets`: ok (target installed here)
- `cargo run -- watch` with timeout 3: starts and blocks, no error. No hardware was used.

Tests: 7 hardware-free tests cover the wake logic, stop before run, double stop, stop during a blocked run, Send/Sync/Clone, and the None default.

Notes for phase 2 and the PR:
- Commit trailer says Claude Haiku 5.5 because that is my model. The task brief asked for Opus 5.5 — please confirm which you want. Not changed without asking.
- Docs updated: README library section, rustdoc, and CLAUDE.md discovery line.
- Not done: no change to `src/cli/watch.rs` or the examples (Ctrl-C not required).
- Pre-existing, not touched: if udev's socket reports POLLERR/POLLNVAL, the loop could spin. This was already the case before this PR.

Phase 2 (Spectrum Studio) can start after the human merges PR #77 and the release is out. It should bump sa430, call `stop()` in `AutoConnect::shutdown`, and join the watcher thread.
