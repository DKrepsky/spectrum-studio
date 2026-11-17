# 011 Outcome — accepted 2026-11-17
Issue: #1

| Criterion | Result | Evidence |
| --- | --- | --- |
| Root cause written | Pass | plan.md: frontend `failed` marker + stale connect `commandError` never cleared by SessionStatus; plug-in dropped while Connecting |
| Re-plug reaches Connected, error cleared | Pass | QA simulated (EBUSY holder + sa430 reboot) shots 04–06 vs baseline-HEAD; human physical test OK |
| Selector/status bar/capture agree with SessionStatus | Pass | shots 05, 07, 08; status.test.ts, SourceMenu/SourceButton tests |
| Failed Reconnect leaves no bad state | Pass | Rust R1–R3 (autoconnect 33/33) |
| Regression tests, `npm run check` green | Pass | PM re-ran check: exit 0 |
| Human physical test | Pass | human: "Works: accept + commit" |

Extra in this change (human: "fix in this change"): BUG-011-QA-1, two pre-existing acquisition.e2e failures —
test-side fix (Badge ellipsis hides text from getText; status-bar frame number is throttled to 500 ms). Full e2e with
SA430: 11/11 files, 115 passing. See tasks/T3-result.md.
