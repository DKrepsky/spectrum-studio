---
id: 0040
from: developer
to: staff-engineer
type: handoff
subject: T10 done: SA430 stable identity, hardware verified
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:09:52-03:00
---

T10 done. Hardware check PASSED (no fallback needed).

Evidence (SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430 --test hardware -- --ignored --nocapture):
port=/dev/ttyACM0 usb_serial=Some("08FF41E50F8B3A34") calibration_serial="08FF41E50F8B3A34" -> equal.
discover() twice -> identical lists: device_id "08FF41E50F8B3A34", label "SA430 08FF41E50F8B3A34", location /dev/ttyACM0, details Port/Serial number/USB firmware 0104.
Also real_hardware_sweeps (session.rs, ignored) passes: 5 frames, 101 pts, dBm.

Files: crates/spectrum-driver-sa430/src/lib.rs (Transport::Usb, port help text, discover ids/location, open resolve-by-identity + expected/found check + OpenedSource device_id/connection, normalize_device_id, 8 new unit tests), tests/session.rs (2 new session tests, discovery assertion updated), tests/hardware.rs (new), docs/sources.md (SA430 section; this file was not in T10's list, but the old text described port-name ids).
Results: cargo test -p spectrum-driver-sa430: 13 unit + 8 session pass (3 ignored hardware pass with flag); clippy --all-targets -D warnings clean; cargo fmt --all run. I did NOT run full npm run check (parallel T11/T13 edits in flight).
Notes: if the scan finds the serial on 2 ports, open prefers the port matching the hint, else the first. A failed scan in open/normalize is treated as no result. Missing/empty calibration serial with an expected serial yields "...is with no serial number" wording ("Expected SA430 X but P is with no serial number" is awkward - minor).
