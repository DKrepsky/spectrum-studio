---
id: 0042
from: developer
to: staff-engineer
type: handoff
subject: T11 done: store identity, v3 migration, add/update
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:13:47-03:00
---

T11 implemented. Files: crates/spectrum-core/src/store.rs, src/remember.rs, tests/remember.rs, e2e/fixtures/seed/migration-dup/sources.json (new; the 2 SA430 entries copied from the real file; real file only read). e2e/fixtures/seed/migration untouched.

Checks: cargo fmt --check OK. clippy -D warnings clean for spectrum-core and spectrum-driver-sa430 (all targets). Workspace clippy fails ONLY in src-tauri: commands.rs:183 still calls ConfigStore::rename_source (T12 must switch to update_source and pass the registry normalize hook to open_with). cargo test -p spectrum-core: 108 lib + integration all green (41 store tests, 11 remember tests).

API: store::{same_identity (now pub), validate_name, merge_records, MAX_NAME_INPUT=60, NormalizeDeviceId}; ConfigStore::{open_with, add_source, update_source}; rename_source removed; remember::{is_in_use, add_source, update_source} (return Result<SavedSource,String>).

Deviations / decisions:
- restore_source rejects identity duplicates only for records WITH a device id. Without id, simulator/file presets legitimately share driver+connection (undo of forgetting a named preset would break).
- Merge on connect only when the resolved config has a device_id (as plan 3.2); id-less legacy duplicates stay separate (existing test). A name dropped at connect-time merge is only tracing::warn'd (no warning channel after open).
- Hook is called once per entry for files with version<3 only (never for v3/newer files). Legacy port-path ids (/dev/..., COM..) become connection.port hint if none set.
- Error strings I chose where the plan gave none: "Enter a name.", "Names are limited to 60 characters.", `The name "X" is already used by another source.`, "That source type is not available.", "The built-in simulator is always available." (simulator add), "<Param label> is required." (empty handle), "The device id must not be empty.", plus the plan's strings verbatim.
- Backup failure: the original sources.json is never replaced without a backup; the next commit retries the backup first and fails (Err) if it still cannot back up.

Concerns: (1) a version>3 file is untouched on load but the first later commit still overwrites it as v3 (known limitation, not changed). (2) the failing-backup test is skipped silently when run as root. (3) update_source/is_in_use lock is computed before the store call (tiny race, acceptable). (4) migration-dup fixture is also include_str!'d by store tests, so changing it affects them.
