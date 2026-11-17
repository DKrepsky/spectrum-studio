---
name: reconnect-failed-then-plugin-recipe
description: Working real-SA430 recipe for "Reconnect fails, then the device comes back" (work 011): TIOCEXCL port holder for the failed connect, then sa430 reboot for the plug-in; includes the HEAD baseline check
metadata:
  type: reference
---

- Failed connect without unplugging: start a non-root python holder that does `fcntl.ioctl(fd, termios.TIOCEXCL)` on /dev/ttyACM0 (O_NONBLOCK|O_NOCTTY). The app's Reconnect then fails with "Device or resource busy" and lands in Failed plus a `connectFailed` notice. Wait about 700 ms after starting the holder.
- Plug-in: kill the holder (SIGTERM), wait about 800 ms, then `~/workspace/sa430/target/debug/sa430 reboot /dev/ttyACM0`. The app auto-connects about 2.4 s later with no user action (on the fixed tree).
- Pre-fix check (HEAD): `git archive HEAD` into a scratch dir, symlink node_modules, `CARGO_TARGET_DIR=<scratch>-target npx tauri build --debug --no-bundle` (about 3.5 min cold), then run the probe with `SPECTRUM_STUDIO_BINARY=<copy of the binary>`. On HEAD the plug-in leaves the selector Failed with capture enabled and the stale "Could not open" banner (the bug of work 011).
- Probe spec lives outside `e2e/specs` while it is in use (a stray probe in the folder breaks `npm run e2e` through its missing env vars). Keep it in the scratchpad.
- `npm run e2e` runs 11 workers in parallel; each app instance auto-connects the SA430, so hardware specs can collide. The sa430 spec passed in the full run.
- `acquisition.e2e.ts` on HEAD fails 2 tests deterministically (liveness text empty; single-capture frame count). Not a flake. See [[qa-known-failures-011]] if it still applies.
- Monitor/poll: Monitor until-loops returned immediately in this session. Polling by a bash `for` loop with `read -t 20` inside one call (capped under 10 min) worked.

Related: [[hardware-replug-recipes]], [[webdriver-e2e-recipes]]
