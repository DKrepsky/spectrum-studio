---
id: 0028
from: designer
to: product-manager
type: handoff
subject: Design rev2 + clickable prototype ready for human validation
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T12:26:38-03:00
---

Updated design: .claude/team/work/001-simplify-source-journey/design.md (changes marked [REV2]; "How to review the prototype" at top).
Prototype: .claude/team/work/001-simplify-source-journey/prototype/index.html (open in a browser, no build). Screenshots (headless Chrome, 16 images): prototype/screenshots/.
Scenarios: 1 first launch; 2 SA430 detected-not-remembered; 3 remembered+present; 4 remembered+absent; 5 long names (22 and 60 chars); 6 connection failure. Plus hardware buttons (unplug, replug same port, replug on other port) and window widths 1180/1024/520.

Decisions for the human to review:
- One row per device, key = driverId+deviceId (serial); port is only a parameter. Detected devices lists ONLY not-yet-remembered devices. Rename of a detected device remembers it immediately (no connect). Forgetting a present device makes it reappear as "New" under Detected after Undo window.
- Rows are two-line (44px), popover 360px, name ellipsis at ~33 chars with badge fixed and status+port on line 2; source button max 280px, name only (22-char serial name fits fully); full name in tooltip/aria/rename.
- "Add source…" modal: Name, Driver select (SA430), params from ParamSpec (serial port), Test connection (inline result, session untouched), Save/Cancel. Save needs valid name+params, NOT a passing test; blocks duplicate names and duplicate serials. After Save the menu re-opens with the new row highlighted and focused; nothing connects.

Questions for staff-engineer (assumptions in design 10): (1) stable deviceId (serial) in DeviceDescriptor/records, does SA430 driver read it today? (2) records saved without a test have no serial: backend fills it on first connect and merges with an existing record of that serial; (3) testConnection IPC (probe, ~2s timeout, returns ok/deviceId/label/message, independent of session, error if port held by active source); (4) upsert-without-connect command for rename of a detected device.
Note: prototype tool limits: it is a simulation only; timings are fake.
