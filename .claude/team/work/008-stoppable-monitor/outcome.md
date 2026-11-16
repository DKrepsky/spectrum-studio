# 008 Stoppable sa430 device watcher — outcome
Phase 1 (lib): issue #76 / PR #77 (stop handle) and issue #78 / PR #79 (poll error spin) merged by the human; released
as sa430 0.2.2 (release-plz bumped patch, not 0.3.0).
Phase 2 (Studio): sa430 0.2.2 adopted; generic `stop_watch` capability; AutoConnect shutdown stops and joins watchers
(bounded 1 s, unstoppable drivers stay detached). Staff-engineer approved (review-phase2.md); `npm run check` green
(PM re-ran); real SA430: clean exit (watcher joined in ~4–7 ms, process gone ~60 ms), plug-in auto-connect re-verified via
re-enumeration after the seam change. Physical unplug while connected not re-run (no code change on that path).
Non-blocking follow-ups (review-phase2.md nits): sticky stop flag for the driver lifetime; a monitor without stop handle
makes shutdown wait the full 1 s.
