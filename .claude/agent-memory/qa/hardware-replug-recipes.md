---
name: hardware-replug-recipes
description: Non-root ways to simulate SA430 re-enumeration and port contention for auto-connect QA (sa430 CLI reboot, python TIOCEXCL holder, what is impossible without root)
metadata:
  type: reference
---

- Re-enumeration without root: `~/workspace/sa430/target/debug/sa430 reboot /dev/ttyACM0` (the CLI takes the
  PORT argument; running it without one gives a clap error). It works when the app does NOT hold the port.
  Observed: udev remove+add, the app's auto-connect reconnects 1.2-1.3 s later (paused).
- With the app connected, `reboot` fails with `serial port error: Device or resource busy` (the app holds
  the port exclusively). No event reaches the app; the state stays Connected. So a Removed-while-connected
  event cannot be produced without a physical unplug.
- Simulator as the active source does not hold the port: `reboot` while the simulator plays gives an
  Added/Removed pair the app must ignore (verified: stayed on simulator, Acquiring, frames kept rising).
- Port contention: a python3 process that opens `/dev/ttyACM0` with `O_NONBLOCK` and calls
  `fcntl.ioctl(fd, termios.TIOCEXCL)` makes the app's connect fail with EBUSY (one ConnectFailed, no retry).
  Kill that process by its own PID (you started it); `fuser` may still report it for a moment after SIGTERM.
- Not possible without root here: USB unplug, `/sys/bus/usb/devices/1-3/authorized` (root-owned), the
  `cdc_acm` unbind node, `/dev/bus/usb/001/008` (root:root 664) for USBDEVFS_RESET.
- Hiding the device to test "no hardware at launch": not possible without root. Rely on core tests.
- wdio probes: a spec can call `child_process.execFileSync` to run the CLI at the right moment, and
  `browser.reloadSession()` restarts the app with the same fresh config dir (the remembered entry survives).
  The app's stderr logs appear in the wdio stdout, so set `RUST_LOG` on the wdio command.
- Temporary probe specs with a 63-char name silently failed (the dialog refuses >60 chars and stays open).
  Count the test string with `.length` first.

Related: [[webdriver-e2e-recipes]]
