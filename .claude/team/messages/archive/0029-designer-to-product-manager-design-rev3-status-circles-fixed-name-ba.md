---
id: 0029
from: designer
to: product-manager
type: handoff
subject: Design REV3: status circles, fixed name/badge width, Edit source dialog
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T12:42:25-03:00
---

design.md ([REV3]) and prototype/index.html updated; screenshots re-taken (headless Chrome, 25 files in prototype/screenshots/) and viewed.

Changes
1. Status circle (rows + source button): green filled = connected/acquiring (halo ring), red X = failed, gray filled = detected/usable but not connected, hollow gray = not detected/lost, blue pulsing circle = connecting/disconnecting (static ringed under reduced-motion). Simulator/files/network (unprobeable) = gray filled; no circle on the button with no source. Text always alongside (design 2.0, 5). Tokens only: green is existing --accent.
2. Fixed widths: grid 18px | 1fr | 64px for every row; badge fills the fixed 64px column so the name column is a constant ~232px (~32 chars). Edit/Forget actions sit in the reserved column under the badge on line 2 (visibility only, zero layout change). Line 2 always rendered so rows are equal height. Verified with the 22- and 60-char names, with and without hover actions, at 1180/1024/520 (05, 05b, 10, 15, 16).
3. Edit: inline rename removed. ✎ and F2 open the same dialog titled "Edit source" (chose "source": also edits files/simulator). Prefilled Name, Driver (locked), Serial port, Test connection, Save/Cancel. Simulator/file: name only (file path shown read-only). Port change re-resolves identity on Test: same serial = OK; different serial = amber note, Save allowed and re-binds serial; serial of another remembered source = Save blocked; untested save keeps old serial and port, a later connect mismatch fails with a backend message. Forget: stays as x on the row AND a Forget button in the dialog (not for detected entries). Detected-not-remembered: dialog prefilled, Save remembers without connecting. Editing the connected source: name applies immediately, connection params are locked until disconnect (no reconnect ever).

Backend needs for staff engineer (design 10 item 5): update-by-id command (name/params/deviceId, uniqueness excluding self), upsert for detected, testConnection usable for an existing record's port returning the serial, re-bind-to-new-serial rule (reject if another record has it), and connect must fail clearly when the serial read differs from the record's. Question: confirm that last behaviour.

Screenshots reviewed: 02,03,05,05b,10,11,12,13,15,16,17 (mismatch),18 (connected/locked),19 (file),21 (detected edit),22 (connecting); 20, 23, 24 taken (simulator edit, long-name edit, menu while connected).

Human to review: "source" vs "device" term; Forget in both places; re-bind on mismatch; param lock while connected; green = existing mint accent.
