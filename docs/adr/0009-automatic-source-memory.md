# ADR 0009 — Automatic source memory and connect-on-pick

Status: accepted (2026-10-31); identity, duplicates, "Other sources" and rename amended by
[ADR 0010](0010-stable-device-identity.md)

## Context

The UI had two notions of a source (selected vs connected), explicit saved configurations with
names, and four controls to switch. Users want to pick "what I am looking at" and press Run
(work item 001). The backend already stops and joins the previous worker on `connect`, so
switching is atomic there.

## Decision

- **Picking is connecting.** Choosing an entry calls one command (`connect_remembered(id)` or
  `connect_source(config)`); the UI never composes stop/disconnect/connect and has no "selected but
  not connected" state. The UI changes its connection state only from `SessionStatus` events.
- **Remembering is automatic and backend-owned.** `sources.json` stays the store ([ADR 0006](0006-local-json-persistence.md)).
  `SavedSource` becomes the *remembered source*: a successful connect upserts it (identity =
  `driverId` + `deviceId` + `connection`), `lastUsedMs` orders it, and the effective centre/span/
  device settings are written back whenever `apply_source_settings` succeeds. Failed connects are
  never remembered. There is no naming or save step; `name` is an optional user override, `label`
  is the automatic name captured from the connected device.
- **Forget / Undo / Rename** are backend commands; Undo re-inserts the removed record.
- **Planned and unknown drivers are not user-visible.** `list_sources` omits entries whose driver is
  not registered or not `Available`; they stay on disk untouched and reappear if the driver does.
  `list_drivers` still reports Planned drivers (registry and docs/roadmap keep them); the UI filters.
- **Detected devices come from one `discover_all` command** (all available discovery-capable
  drivers, per-driver errors in the result), polled by the UI only while the source menu is open.
  `discover` implementations must only enumerate, never open or probe a device.
- **The last active source id** is persisted in `preferences.json` (`lastSourceId`) and restored as
  the selection, never connected automatically (as in ADR 0006). `lastSource` is migrated into a
  remembered entry and then unused.
- `sources.json` goes to schema version 2 (additive: `label`, `lastUsedMs`); v1 files load without
  loss and are rewritten as v2 on the next change.

## Alternatives rejected

- Keep explicit "Save source": two ways to persist, the confusion the story removes.
- UI-side remembering (frontend derives names, writes the list): violates "validate and own
  persistence in Rust" and races with settings changes.
- Drop entries of unavailable drivers on load: data loss when a driver returns.
- Merge duplicate legacy entries: lossless migration forbids it; they stay separate rows.
  *(Reversed by ADR 0010: acceptance showed identical duplicate rows for one device; duplicates of
  one device are now merged on load, with a backup, keeping the user's name.)*

## Consequences

- Removes `save_source`, `delete_saved_source`, `list_saved_sources` and the selected/connected UI state.
- A stale remembered setting could make a source unconnectable; `connect_remembered` retries once
  with default settings (see plan) so Forget is never the only way out.
- ~~SA430 `deviceId` is its serial port name ... a stable device id is a follow-up.~~ Superseded by
  ADR 0010: the SA430 `deviceId` is its serial number and identity is `driverId + deviceId`.

## Amendment (2026-10-31, rework after acceptance)

- "Other sources…" is replaced by **Add source…**, and inline rename by one **Add / Edit source**
  dialog (work item 001 design REV3). Entries are therefore also created without connecting
  (`add_source`, which also remembers a detected device) and edited by id (`update_source`);
  `rename_source` is removed. `test_source` probes a connection without touching the session.
- Identity is `driverId + deviceId` (ADR 0010), not `deviceId + connection`.
- `sources.json` is schema version 3; older files are migrated on load with a backup (ADR 0010),
  which replaces "rewritten as v2 on the next change".
