---
id: 0125
from: developer
to: staff-engineer
type: handoff
subject: T7 BUG-1 fix done: queued Stop behind in-flight Start, frame-aware announcement, check green, SA430 e2e 7/7 x6 on fix
work: 006-capture-modes
reply-to: 
date: 2026-11-09T22:40:02-03:00
---

T7 (BUG-1) implemented, uncommitted, on top of T1-T5. `npm run check` green (259 Vitest, all Rust suites, lint, tsc, prettier).

Files
- src/state/session.ts: `start` keeps a flag while in flight; `stop()` during it queues one Stop (`busy` becomes 'stopping' at once, no null gap) and `sendQueuedStop` runs it inside the start command after the invoke resolves. A second stop returns the same queued promise. A failed start settles the queued stop as not sent. A failed queued stop sets commandError with commandErrorFrom 'stopping'.
- src/components/capture/CaptureControl.tsx: onMain accepts a press when busy === 'starting' && acquiring. The "cancelled" announcement is suppressed when a frame newer than the capture start exists (frameStore seq).
- Tests: CaptureControl.test.tsx (6 new BUG-1 cases), session.test.ts (5 new store cases), crates/spectrum-core/tests/session.rs (stop_during_a_single_sweep_discards_it rewritten with a gated read; new stop_after_the_sweep_was_published_is_a_late_cancel), e2e/specs/sa430.e2e.ts (new hardware case, 5 immediate cancel rounds).
- docs/testing.md: one line for the new SA430 case. .prettierignore: added .claude/team/work/**/screenshots/ (34 generated JSON files broke the Prettier check; same rule as prototype/ and evidence/).

Checks
- npm run check: EXIT 0 (final run after all edits).
- Vitest: 9 of the new tests fail on the pre-fix store/component (verified by reintroducing the old start/stop and onMain temporarily); all pass on the fix. The old "announces a cancelled single capture" also failed in that pre-fix run; likely cascade from an unresolved held start in an earlier test, passes on the fix. Not chased further.
- Rust: stop test run 30x in a loop, 0 failures. The discard and late-cancel contracts already held in the worker, so the Rust tests pin them and do not fail on the pre-fix code (worker untouched, as T7 says).
- E2E SA430 (SPECTRUM_E2E_SA430=1, WebKitWebDriver from scratchpad on PATH, real /dev/ttyACM0, X11): fixed build 6/6 full-spec runs, 7 passing each, so 30 immediate cancel rounds, frame count unchanged and "cancelled" announced in every round. Pre-fix build (temporary, restored afterwards): round 1 failed with a new frame shown ("a frame was shown after Cancel (8 -> 9)"), which reproduces BUG-1.
- No spectrum-studio, WebKitWebDriver or tauri-driver process left running; I did not touch the human's app.

Deviations / notes
- Rust test: the release waits on a flag plus a 50 ms bounded settle, not a pure no-sleep handshake. The worker reads the command queue only after a read returns and T7 forbids changing it, so nothing observable marks "Stop is queued". A too-early release can only make the test fail, never pass wrongly.
- E2E reads the live region with textContent; getText() returned "" on the visually-hidden region (WebDriver omits it).
- Residual race (not fixed here): the frame reaches the UI through the frame pump, which can lag the Connected status. If the status lands before the frame reaches frameStore, a late cancel still says "cancelled". The UI cannot see the backend's publish order; a fix needs a backend signal (e.g. a completed-capture notice or frame seq in the status). Flagging for the PM.
- Store-level stop() during the queued Stop's drain would send a second Stop; the UI prevents it (busy === 'stopping'). Making the store refuse it risked a hang, so left as is.
- Not run: QA's qa-capture-tour.e2e.ts (QA's job per T7).

Pointers: src/state/session.ts, src/components/capture/CaptureControl.tsx, crates/spectrum-core/tests/session.rs, e2e/specs/sa430.e2e.ts. Scratchpad logs: /tmp/claude-1000/-home-kr-workspace-spectrum-kit/a640f3fc-2223-4a00-85a4-79b77b8f32a1/scratchpad/ (e2e-sa430-*.log, check-final.log).
