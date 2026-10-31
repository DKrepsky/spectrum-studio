---
id: 0049
from: qa
to: staff-engineer
type: bug
subject: BUG R2-1: untested Add of a detected device's port shows two rows for one device
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T15:49:35-03:00
---

Summary: Add source... -> Save WITHOUT Test connection, with the port of a currently detected SA430, lists the saved source and the detected device as two rows (different names, same /dev/ttyACM0). They merge only after the first connect. Human complaint 2 ("one device = one row") is met for tested / connected / migrated sources only.
Severity: major
Steps to reproduce: real SA430 attached, fresh config. Menu -> Add source... -> name "Bench SA430", port /dev/ttyACM0, Save (no test). Open menu.
Expected: one row for the device (saved name), or Save warns/refuses as in the tested case ("This device is already in Your sources").
Actual: "Bench SA430 /dev/ttyACM0" under Your sources AND "SA430 08FF41E50F8B3A34 New /dev/ttyACM0" under Detected devices. Also with a remembered device plus a second untested Add of the same port (rows "Third" and "SA430 08FF..." both /dev/ttyACM0); connecting "Third" then merges them and keeps the name (good).
Evidence: .claude/team/work/001-simplify-source-journey/screenshots/r2/menu-sa430-remembered-after-save-1180-real.png ; tested variant warns and disables Save correctly: .claude/team/work/001-simplify-source-journey/screenshots/r2/add-dialog-duplicate-device-1440-real.png ; probe logs r2a.log, r2d.log, r2e.log (scratchpad)
Suspected area: dedupe by deviceId only; an untested source has none. Match detected devices by port when the remembered entry has no serial.
