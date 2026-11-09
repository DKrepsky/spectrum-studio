---
name: sa430-reconnect-hardware
description: Real SA430 re-enumeration and first-open behaviour seen on /dev/ttyACM0 during work 004 (settle, udev race, retry ladder)
metadata:
  type: project
---

Reboot-based simulation of a plug-in on the real SA430 (`SerialBackend` open, `Sa430::reboot`): port node vanishes ~5 ms after reset, returns ~660 ms later. The first open after the node returns often fails with `PermissionDenied` (udev ACL not applied yet), so retries matter even with a 200 ms settle. Without settle the sequence was: denied, "No frame start", timeout, then OK on attempt 4.

**Why:** explains why the zero-settle hardware test needs up to 4 attempts. **How to apply:** do not expect the reboot tests to connect on attempt 1; check the driver retry ladder in `crates/spectrum-driver-sa430/src/lib.rs` (`identify`) and the hardware test output before changing the bound.
