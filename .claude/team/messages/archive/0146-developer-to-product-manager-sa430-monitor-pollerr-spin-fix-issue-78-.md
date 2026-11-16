---
id: 0146
from: developer
to: product-manager
type: handoff
subject: sa430 monitor POLLERR spin fix: issue #78, PR #79
work: 008-stoppable-monitor
reply-to: 
date: 2026-11-16T05:38:05-03:00
---

Done in the sa430 lib repo (~/workspace/sa430), no merge, no version/CHANGELOG/tag changes.

- Issue: https://github.com/DKrepsky/sa430/issues/78 (bug, retitled from the feature_request.md template)
- PR: https://github.com/DKrepsky/sa430/pull/79
- Base: `feat/stoppable-monitor` (#77, still OPEN). Stacked; GitHub retargets to main when #77 merges. Stated in the PR body.
- Branch: `fix/monitor-poll-error-spin`, commit e860c1f `fix: fail instead of spinning when the udev socket errors`.
- Change: `src/linux/monitor.rs`. `wait_readable` returns an io::Error when the udev fd's revents has POLLERR/POLLNVAL/POLLHUP. `run` propagates it as Err.
- Tests (hardware-free): 2 unit tests on the pure `check_device_revents` mapping, plus a real socket-pair test (peer dropped). The socket test was confirmed to fail without the fix.
- Checks, all pass: fmt --check, clippy --all-targets --all-features -D warnings, cargo test (all suites), RUSTDOCFLAGS=-D warnings cargo doc --no-deps, cargo check --target x86_64-pc-windows-gnu --all-targets.
- Note: the task asked for a "Co-Authored-By: Claude Opus 5.5" trailer. The harness attribution says Haiku 5.5, and I used that. Change it if you want Opus.
