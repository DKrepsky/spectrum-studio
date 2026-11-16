---
id: 0142
from: qa
to: product-manager
type: report
subject: 007 auto-connect QA: verdict don't ship yet (conditional)
work: 007-auto-connect
reply-to: 
date: 2026-11-16T05:11:27-03:00
---

Verdict: DON'T SHIP YET (conditional). No defect found in the auto-connect behaviour. Still open: the full e2e suite was not run, the 1024 toolbar and 60-char name check was not completed, and the physical plug/unplug steps need a human.

Full matrix with evidence: .claude/team/work/007-auto-connect/qa.md (screenshots in .claude/team/work/007-auto-connect/screenshots/).

Automated: npm run check exit 0 (cargo test --workspace all ok; core autoconnect 27 and sa430 autoconnect 3 ok). Autoconnect tests repeated 20x plus 10x with 16 threads: no flake. No bindings diff.

Real SA430 (/dev/ttyACM0), isolated XDG_CONFIG_HOME, debug build of the working tree:
- PASS launch with device: auto-connected, Connected (paused), Play not pressed, no notice.
- PASS remembered entry on relaunch: stored centre 434.5 MHz applied; lastSourceId written.
- PASS manual disconnect: 12 s sampled, no reconnect.
- PASS simulator remembered + SA430 present: SA430 connects, simulator never.
- PASS simulator active + SA430 re-enumerated (reboot): source stays simulator, acquiring, frames continue for 10 s.
- PASS re-enumeration while disconnected (sa430 reboot = udev remove+add) x2: auto-connect 1.2-1.3 s, paused.
- PASS failed launch (port held by another process): one ConnectFailed notice (same honest text), no retry in 15 s; next plug-in (reboot) connects.
- PASS UI responsive: IPC reads <= 57 ms during and after connect; Play toggled fine.
- NOT-TESTED: no-hardware launch (cannot hide the device without root); two devices at launch (one device only; core test covers first-wins); Play inside the launch connect window (connect took milliseconds, so not reproducible); physical unplug/replug (no root, no USB reset possible).
- Not run: npm run e2e. The existing SA430 e2e spec comments assume no launch auto-connect; the suite may behave differently on a machine with an SA430 attached.
- Not finished: 60-char name on the auto-connected source at 1440/1024 and keyboard focus ring (probe written, rerun blocked by tool errors). Design 006 Q8 stays open.

Visual (read each screenshot): launch/relaunch/manual disconnect/simulator/notice/menu screens OK; source name not cropped at 1440.

Observation for PM (not a bug, existing design 001): the toolbar source button shows the state only as a green/grey circle; the words are in the accessible name only. Decide if that meets "state not by colour alone".

For the human (only a physical action proves these): plug in with app closed and running; unplug while paused and while acquiring (notice + prompt disconnect, no hang); replug auto-connects paused; two SA430s at launch (first connected, second listed); Play during the first seconds after launch with the window responsive.

Housekeeping done: temporary probe specs and seed deleted, no processes left; the recipes are in .claude/agent-memory/qa/hardware-replug-recipes.md.
