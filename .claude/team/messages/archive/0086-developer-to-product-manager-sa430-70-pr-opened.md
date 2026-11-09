---
id: 0086
from: developer
to: product-manager
type: handoff
subject: sa430#70 PR opened
work: 004-sa430-reliable-connect
reply-to: 
date: 2026-11-09T19:31:17-03:00
---

PR opened, not merged: https://github.com/DKrepsky/sa430/pull/71 (branch `channel-settle-timeout`, commit b201739 on top of origin/main 199b9b2, closes sa430#70).

API (non-breaking):
- `channel::DEFAULT_SETTLE_DELAY` (200 ms). `SerialPortChannel::new` waits it after open, then clears input. `Sa430::open` uses it.
- `SerialPortChannel::with_settle(port, Duration)` (ZERO skips the wait).
- `SerialPortChannel::set_timeout(&mut self, Duration) -> Result<()>` and `timeout(&self) -> Duration`. Default 5 s. Errors map to `Error::Serial`.
- `SerialError::new(kind, msg)` behind `cfg(any(test, feature = "test-utils"))`.
- No serialport types in the public API. Docs: channel.rs module docs, CLAUDE.md channel.rs line, README snippet, docs/protocol.md settle section.

Checks (sa430 repo): fmt, clippy -D warnings, cargo test (all pass), RUSTDOCFLAGS=-D warnings doc, windows-gnu check: all green. Unit tests use a pty pair on unix, serialised with a lock. Mutation check: removing the input clear fails the stale-input test.

Hardware (/dev/ttyACM0, SA430 08FF41E50F8B3A34): reboot, wait for the node, connect at once.
- Default (`sa430 info`): 10/10 valid reboot cycles connected on the first attempt, no permission retries.
- Settle 0 control (scratch program, not in PR): 5/5 valid reboot cycles failed with NoFrameStart. Some iterations did not reboot (the device was one reply behind after a failed connect), and those are excluded.

Deviations and notes:
- Co-Authored-By uses Claude Haiku 5.5 (the attribution rule given in the session), not Opus 5.5 as the task text said.
- To free the port, I stopped the running Spectrum Studio process (pid 35316, from the spectrum-kit `tauri dev` session) with SIGTERM. Its tauri/vite parents were left running. Restart the dev app if you need it.
- Follow-up for spectrum-kit: `SerialBackend::open` / `SerialLink` can switch to `SerialPortChannel::with_settle` once this is released. Not done here.
- Scratch probe and logs are in the scratchpad, not in the repo.
