# ADR 0010 — Stable device identity

Status: accepted (2026-10-31). Amends [ADR 0009](0009-automatic-source-memory.md) and
[ADR 0006](0006-local-json-persistence.md).

## Context

ADR 0009 identified a remembered source by `driverId + deviceId + connection`, and the SA430
driver used the serial *port name* as `deviceId`. Acceptance of work item 001 found two remembered
entries for one SA430 (`deviceId = null` and `deviceId = "/dev/ttyACM0"`, both labelled
"SA430 08FF41E50F8B3A34"), rendered as two identical rows. Root causes: the port is transient
(replugging changes it), and a connect without a device id succeeded by auto-picking the first
device but stored no identity. Renaming a source could not survive a replug on another port.

## Decision

1. **A device's `deviceId` is a stable hardware identity chosen by the driver, never by the
   caller.** SA430: its serial number. When a device exposes no serial the driver uses
   `port:<port name>` (explicitly unstable, labelled with the port). Two ports reporting the same
   serial are also given `port:` ids so they never collide.
2. **The connection is a hint, not identity.** `SourceConfig.connection` (for the SA430 the
   `port` text) says where the device was last found. `SourceDriver::open` resolves the device by
   `deviceId` first (scan), uses the hint only if the device is not found by scan, and verifies the
   identity it actually opened: a mismatch fails with a message naming the expected and found
   serial. A caller never silently gets a different device.
3. **`open` reports the resolved identity.** `OpenedSource` gains `device_id` and `connection`;
   the session stores them into `ActiveSource.config`, so the remembered record is always saved
   with its identity filled in (a device can no longer be remembered without one) and a refreshed
   connection hint.
4. **Matching key** (`store::same_identity`): `driverId + deviceId` when both sides have a
   `deviceId` (connection ignored); otherwise `driverId + connection` with no `deviceId` on either
   side. A connect or an edit that makes two records share an identity *merges* them (the user's
   name wins, the older `createdMs`, the newest settings) instead of creating a duplicate.
5. **Load-time migration with backup.** `sources.json` moves to schema version 3. When an older
   file is loaded, `ConfigStore::open_with` asks each entry's driver to normalize its `deviceId`
   (`SourceDriver::normalize_device_id`, so serial knowledge stays in the driver crate), merges
   legacy duplicates, repairs `lastSourceId`, copies the old file to
   `sources.pre-v3-<timestamp>.json` and rewrites the file atomically. This supersedes ADR 0009's
   "legacy duplicates stay separate" and its "a v1/v2 file is only rewritten on the next change".
   Merging is restricted to entries that cannot both be intended: device entries with the same
   identity, and non-device entries with the same driver, connection and displayed name. Distinct
   named presets of the simulator or a file are never merged.
6. **Entries can be created and edited without connecting.** Commands `add_source` (also used to
   remember a *detected* device) and `update_source` (by id: name, connection, identity), and
   `test_source` (open, read identity, close; does not touch the session). `update_source` is
   validated in Rust: unique name, unique identity, no connection change on the source that is
   connecting or connected, file and simulator entries can only be renamed. `rename_source` is
   removed (superseded by `update_source`).
7. **Untested port edits keep the old identity.** The edit changes only the hint; the next connect
   finds the device by identity, or, if it is absent, opens the hint and fails with the
   expected-versus-found message. Only a successful *Test connection* that the user saves re-binds
   a record to a different serial.

## Alternatives rejected

- Keep the port as identity and de-duplicate in the UI: the rename could never survive a replug.
- Identify by USB descriptor in `discover` and by calibration serial in `open` without checking
  they agree: if they ever differ every record would look "Not detected". They are verified equal
  on real hardware first (plan task T9); if not, `open` derives the id from the same scan data.
- Require a passing test before saving: hardware may be off or unplugged when the user sets it up.
- Merge every duplicate regardless of name: would destroy distinct named presets.

## Consequences

- Rename, settings and order follow the physical device across ports and replugs; one row per
  device in the menu.
- A one-time backup file appears next to `sources.json` the first time the app starts after the
  update; the app keeps working if the backup or rewrite fails (the migration is repeated in
  memory and retried on the next write).
- If two named records are merged, the less recent name survives only in the backup; a store
  warning tells the user.
- Drivers implement two small additions (`device_id`/`connection` in `OpenedSource`, optional
  `normalize_device_id`); documented in `docs/sources.md`.
