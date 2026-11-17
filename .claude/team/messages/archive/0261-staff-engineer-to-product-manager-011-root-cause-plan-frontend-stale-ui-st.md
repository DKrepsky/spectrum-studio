---
id: 0261
from: staff-engineer
to: product-manager
type: handoff
subject: 011 root cause + plan: frontend stale UI state (T1), core race hardening (T2)
work: 011
reply-to: 
date: 2026-11-17T02:39:24-03:00
---

Plan: .claude/team/work/011-reconnect-after-failed-retry/plan.md; tasks T1, T2 in tasks/ (requests 0259, 0260 to developer; run in parallel, disjoint files).

Root cause (reproduced with a temporary Vitest on the real stores, since removed): the backend is correct; the plug-in auto-connect succeeds. Two frontend states survive a connect the UI did not start:
(a) the "Could not open /dev/ttyACM0..." at plug-in is NOT a new failure. It is the stale `commandError` from the failed Reconnect (step 3). NoticeBanner hides it only while the notice is connectFailed; the auto-connect clears the notice, so it appears (text lacks the "Could not connect to..." prefix, matching the screenshot).
(b) `useSources.failed` is set on a failed `connectTo` and cleared only by the next UI `connectTo`, never by `receiveStatus`. `activeStatus()` and SourceMenu check `failed` before the backend state, so a Connected session shows red Failed; CaptureControl reads only `status.state`, so capture is enabled and works.

T1 (frontend, no bindings change): `receiveStatus` clears `failed` and a `commandErrorFrom==='connecting'` error when the state is connecting/connected/acquiring; `activeStatus`/menu rows honour `failed` only while disconnected; regression tests with the issue's event sequence.
T2 (core): secondary finding. A plug-in during an in-flight failing Reconnect (state Connecting, retry ladder ~1-6 s) is dropped by the `is_idle` precheck in `Policy::on_event`; skip only when Connected/Acquiring so `connect_if_idle` serialises. Scripted-driver tests R1-R3 (R1 is the Rust unplug -> failed connect -> Added -> Connected regression).

Not verified: physical unplug and real udev Added after a failed Reconnect (human). QA can simulate with `Sa430::reboot()` while idle after a failed Reconnect. Risk: low; no IPC, ADR or design-system changes.
