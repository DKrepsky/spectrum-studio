---
name: app-exit-check
description: Recipe to launch the debug app on this machine with an isolated config, close its window and time the exit (wmctrl works, xdotool not needed)
metadata:
  type: reference
---

- Build: `npx tauri build --debug --no-bundle` embeds the frontend; binary at `target/debug/spectrum-studio`.
- Launch in the background with `XDG_CONFIG_HOME=<scratch>/xdg DISPLAY=:0 RUST_LOG=info,spectrum_core=debug exec ... &`
  and save `$!`. Use `exec` inside the subshell so the PID is the app itself.
- Find the window by PID: `wmctrl -l -p` (column 3 is the PID). Close like a title-bar click: `wmctrl -i -c <id>`.
  This sends WM_DELETE, so `RunEvent::Exit` runs, unlike a SIGTERM.
- Time exit by polling `kill -0 $PID` every 10 ms. Do not `wait $PID` from a different shell: it returns 127.
- Logs go to stderr with timestamps; the shutdown lines are `device watcher stopped`, `device watcher joined at shutdown`
  and `source disconnected` (debug level for `spectrum_core`).

**Why:** work 008 phase 2 needed exit timing evidence for the stoppable SA430 watcher. **How to apply:** reuse for any
exit-path check; check `pgrep -x spectrum-studio` first and only close the PIDs you started.
