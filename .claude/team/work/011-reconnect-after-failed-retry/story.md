# 011 Reconnect works on plug-in after a failed Reconnect
Issue: #1 (GitHub; the bug and expected behaviour live there)
Status: accepted (2026-11-17)

## Acceptance criteria (team-only, derived from #1)
- [ ] Root cause written in plan.md with evidence: (a) why the plug-in connect fails with
      "Could not open /dev/ttyACM0: serial port error" after a failed Reconnect, and (b) why the
      source selector stays "Failed" while capture is enabled and acquisition works (UI state
      diverges from backend state — must not happen).
- [ ] Steps 1–4 of #1: after re-plug the source reaches Connected and the error/banner state clears,
      with no user action (auto-connect on plug-in, work 007) — or at worst one Reconnect click succeeds.
- [ ] The source selector, status bar and capture button always agree with the backend
      `SessionStatus`; a Failed source never has an enabled capture button, and a working
      acquisition never shows Failed.
- [ ] A Reconnect pressed while the device is absent fails cleanly and leaves no state (open port,
      pending connect, stale error) that breaks the next connect.
- [ ] Regression tests: Rust (session/driver with scripted backend: failed connect then plug-in event
      → Connected) and frontend (status reducer / selector state from event sequence). `npm run check` green.
- [ ] QA on the real SA430 simulates what it can; the human does the physical unplug/replug test.

## Notes
- Flow: hardware bugfix (no UI redesign, skip designer). Staff engineer root-causes first.
- Hardware specifics stay in `crates/spectrum-driver-sa430/`; UI reflects SessionStatus only.
- Check the sa430 lib (~/workspace/sa430) before app-side workarounds.
