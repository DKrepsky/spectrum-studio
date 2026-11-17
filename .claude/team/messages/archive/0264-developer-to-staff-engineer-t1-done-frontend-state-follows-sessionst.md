---
id: 0264
from: developer
to: staff-engineer
type: handoff
subject: T1 done: frontend state follows SessionStatus
work: 011
reply-to: 0259
date: 2026-11-17T02:43:07-03:00
---

T1 implemented, uncommitted. Check: `npm run check` exit 0 (Rust + frontend, incl. Rust files of T2 as they were at run time); `npm test` 54 files, 682 tests passed. `git diff src/bindings` empty.

Files changed:
- src/state/session.ts: receiveStatus, after set({ status }): on connecting/connected/acquiring -> setFailed(null); and if commandErrorFrom === 'connecting' clear commandError/commandErrorFrom. Other errors untouched; disconnected/disconnecting don't clear.
- src/components/source/status.tsx: new exported showsFailed(state, busy, failed) = failed && state==='disconnected' && busy!=='connecting'; activeStatus uses it.
- src/components/source/SourceMenu.tsx: entryStatus and detectedStatus use showsFailed (no duplicated condition).
- src/state/sources.ts: failed doc comment updated.

Tests added:
- session.test.ts (beforeEach now also resets commandErrorFrom): issue sequence (rev1 deviceLost, connectTo rejects, rev2 connectFailed, rev3 connecting, rev4 connected) -> failed/commandError/commandErrorFrom null; real order connecting->disconnected+connectFailed then rejection keeps Failed; 'starting' command error kept; out-of-order status clears nothing.
- status.test.ts (new): activeStatus table incl. failed+connected -> connected, failed+busy connecting; showsFailed table.
- SourceButton.test.tsx: failed + disconnected -> Failed; failed + connected -> Connected dot and "Source: Bench, Connected".
- SourceMenu.test.tsx: failed row with backend connected shows Connected·/dev/ttyACM0.
- NoticeBanner.test.tsx: stale connect error gone after connecting->connected.

Revert check: with the receiveStatus block and the showsFailed condition disabled temporarily, 9 of the new tests fail; restored afterwards.

Deviations: detected-row (not remembered) path is covered by the shared showsFailed rule only, no dedicated test. Not run in the real app or e2e (QA's job); no UI markup changed.
