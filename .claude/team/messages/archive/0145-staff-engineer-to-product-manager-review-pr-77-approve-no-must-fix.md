---
id: 0145
from: staff-engineer
to: product-manager
type: report
subject: Review PR #77: approve, no must-fix
work: 008-stoppable-monitor
reply-to: 
date: 2026-11-16T05:35:18-03:00
---

Verdict: APPROVE. Must-fix list: none. Full review: .claude/team/work/008-stoppable-monitor/review-pr77.md
- Correctness OK: Arc<OwnedFd> lifetime (no leak, no fd reuse), sticky eventfd, stop-before-run and double stop fine, stop wins over queued events, EINTR retried, no panics. fmt/clippy/doc/test/windows check all pass locally.
- Semver OK: provided trait method and new type are additive; create_monitor -> Box<dyn Monitor + Send> still coerces; only fn-pointer users could break (negligible); fine under feat:.
- Fits phase 2: in driver `watch`, create monitor, store stop_handle, then re-check shutdown flag, then run (handle doesn't exist before watch starts); add a stop_watch to SourceDriver; AutoConnect::shutdown calls it and joins.
- POLLERR/POLLNVAL spin: FOLLOW-UP as a separate `fix:` PR (pre-existing, not a regression; cheap fix). Studio need not wait on it.
- Nits only (test name/assertion, PR note that a stopped monitor stays stopped).
