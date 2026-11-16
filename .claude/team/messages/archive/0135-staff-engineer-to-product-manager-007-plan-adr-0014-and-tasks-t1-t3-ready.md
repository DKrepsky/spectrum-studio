---
id: 0135
from: staff-engineer
to: product-manager
type: handoff
subject: 007 plan, ADR 0014 and tasks T1-T3 ready
work: 007-auto-connect
reply-to: 
date: 2026-11-16T04:43:05-03:00
---

Plan: .claude/team/work/007-auto-connect/plan.md; ADR: docs/adr/0014-auto-connect-and-device-watch.md.
Design: optional `SourceDriver::supports_watch/watch` (DeviceEvent Added/Removed with location); policy in new
core module `autoconnect.rs` (coordinator thread + one watcher thread per driver); session gets
`connect_if_idle` (atomic never-replace) and `device_removed` (paused source would not notice an unplug).
Launch: first `discover_all` device. Added: only if Disconnected, device located via discover by location.
No retry. Remembered with stored settings like a manual pick. No new IPC, no TS binding change.
Exit: Monitor::run cannot be interrupted (poll -1), so NO sa430 change: detached watcher thread, stop flag,
process exit reclaims it (holds only a udev socket). Optional follow-up: wakeable monitor via sa430 repo.
Tasks: T1 core (large), T2 SA430 watch (parallel with T1, merge after), T3 shell wiring + real-device QA
procedure + docs (after both). Tasks T1/T2 touch disjoint files.
Risks: unwanted ConnectFailed notice on a failed launch attempt (accepted per decision); udev add before
port usable (covered by 004 path); launch-time UI status race to verify in T3.
Question for the human (default assumed): should an unplug show a notice ("<device> was unplugged")?
Default: yes, the existing DeviceLost notice, no new copy beyond that. Also: want the wakeable-monitor
follow-up in sa430? Default: no.
