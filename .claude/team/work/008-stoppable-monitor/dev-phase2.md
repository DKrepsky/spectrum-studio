# 008 phase 2: developer evidence (real SA430, app exit)

Date: 2026-11-16. Device: SA430 08FF41E50F8B3A34 on /dev/ttyACM0. No human-started Spectrum Studio was running
(checked with `ps`/`pgrep -x spectrum-studio` before starting; nothing was killed except the instances started here,
which exited on their own).

## Method
- Binary: `npx tauri build --debug --no-bundle` (frontend embedded), `target/debug/spectrum-studio`.
- Isolated config: `XDG_CONFIG_HOME=<scratchpad>/xdg`, `DISPLAY=:0`,
  `RUST_LOG=info,spectrum_core=debug,spectrum_driver_sa430=debug`, stderr to the scratchpad.
- Launch auto-connect, then close the window with the window manager (`wmctrl -i -c <window id>`, a WM_DELETE request,
  the same as the title-bar close). Time from the close request to the process disappearing (poll `kill -0`, 10 ms).

## Results (two cycles)

| run | close request (UTC) | watcher stopped | joined | source disconnected | process gone after close |
| --- | --- | --- | --- | --- | --- |
| 1 | 08:56:23.761 | 08:56:23.768 (+7 ms) | 08:56:23.768 | 08:56:23.770 | 64 ms |
| 2 | 08:56:38.982 | 08:56:38.986 (+3.5 ms) | 08:56:38.986 | 08:56:38.987 | 58 ms |

Log of run 1 (ANSI codes stripped; run 2 is the same shape):

```
08:56:12.153 INFO  spectrum_core::session: connecting source driver=sa430
08:56:12.394 INFO  spectrum_core::session: source connected driver=sa430 device=SA430 08FF41E50F8B3A34
08:56:12.396 INFO  spectrum_core::autoconnect: auto-connected device=SA430 08FF41E50F8B3A34
08:56:23.767 DEBUG spectrum_core::autoconnect: device watcher stopped driver=sa430
08:56:23.767 DEBUG spectrum_core::autoconnect: device watcher joined at shutdown driver=sa430
08:56:23.770 DEBUG spectrum_core::session: source disconnected
```

Before the close, the process had 24 threads, including `device-watch-sa` (the watcher) and `auto-connect`.
Both are gone at exit; the process exited with the window close and no `SIGTERM`/`SIGKILL`.
Raw logs: `<scratchpad>/evidence/run1.clean.log` and `run2.clean.log`.

## Not covered by the device run
- A watcher that is stuck or unstoppable at exit (covered by the fake-watcher tests: bounded 1 s wait, then detach).
- A plug/unplug while the app runs (the phase-1 and work-007 runs cover it; this run did not unplug the device).
