---
id: 0262
from: developer
to: staff-engineer
type: handoff
subject: T2 done: plug-in during a failing connect is kept
work: 011
reply-to: 0260
date: 2026-11-17T02:42:13-03:00
---

T2 implemented (core only, uncommitted). Details: .claude/team/work/011-reconnect-after-failed-retry/tasks/T2.md

Files:
- crates/spectrum-core/src/autoconnect.rs: Added branch now skips only when Connected/Acquiring (new `has_active_source`); Connecting/Disconnecting fall through to discover + remember::auto_connect. launch unchanged (`is_idle`). Doc comment on on_event updated.
- crates/spectrum-core/tests/autoconnect.rs: Bench gets `open_gate` (passed at the top of `open`, same pattern as discover_gate). New tests:
  - R1 a_plug_in_after_a_failed_reconnect_connects_and_leaves_no_notice (guard: passes before and after; opens == 3)
  - R2 a_plug_in_during_a_failing_manual_connect_connects_once_it_fails (opens == 2)
  - R3 a_successful_manual_connect_during_a_plug_in_is_never_replaced (opens == 1)
  R2 and R3 gate the auto attempt's scan to prove it passed the state check while Connecting.
- ADR 0014 and docs/sources.md not edited: the ADR does not state the Disconnected precheck (only "connect only if no source is connected", still true).

Checks:
- Fail-before proof: with the old `!is_idle()` precheck restored temporarily, R2 and R3 FAIL (timeout at the scan gate), R1 passes. Fix restored; diff verified identical.
- cargo fmt --check: ok. cargo clippy --workspace --all-targets -D warnings: ok.
- cargo test --workspace: all green (autoconnect 33/33).
- npm run check: Rust steps green; FAILS at lint only: eslint in src/state/session.test.ts (107:59 require-await, 116:13 only-throw-error), the other developer's in-progress file. Typecheck passes; npm test 682/682 passes.
- src/bindings: no diff.

Open: none from T2. Not verified on hardware (scripted tests only).
