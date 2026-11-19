---
name: project-auto-connect
description: Work 007 auto-connect (accepted 2026-11-16): human's policy choices and the "use the sa430 watcher" direction
metadata:
  type: project
---

Work 007 (accepted + committed 2026-11-16): auto-connect at launch and on plug-in while idle. Human chose: connect only
(never auto-Play), first discovered device (not last-used), and event-driven via the sa430 udev `Monitor` ("use the
watcher feature") instead of polling or a retry loop. Never replaces an active source; simulator never auto-connected (SUPERSEDED 2026-11-19 by 015: simulator fallback + idle-simulator replacement, see [[project-measurement-rows-014-015]]).

**Why:** human wants zero-click startup with real hardware but keeps control of acquisition; prefers using his own sa430
lib's capabilities over app-side workarounds.
**How to apply:** when a feature touches devices, check the sa430 lib (~/workspace/sa430) for an existing capability
first. Agents can simulate replug only while the app is idle (`Sa430::reboot()`); physical unplug-while-connected
stays a human test. New behaviour that changes launch state breaks e2e assumptions — budget an e2e update with the
SA430 attached before commit. Related: [[feedback-hardware-bugfix]], [[project-sa430-lib-followup]].
