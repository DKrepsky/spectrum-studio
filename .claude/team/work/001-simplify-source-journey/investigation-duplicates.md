# Investigation: duplicate "SA430 08FF41E50F8B3A34" rows (Amendment 1, item 2)

## Root cause (evidence from the human's own store)

`~/.config/io.github.spectrumstudio/sources.json` contains **two remembered SA430 entries for one
physical device**, both with `label: "SA430 08FF41E50F8B3A34"` and empty `name`:

| id | `config.deviceId` | `config.connection` |
| --- | --- | --- |
| `src-1a19264b6bb` | `null` | `{}` |
| `src-1a192659456` | `"/dev/ttyACM0"` | `{}` |

Mechanism:

1. `Sa430Driver::open` resolves the port as: `config.deviceId`, else typed `port` param, else the
   first discovered device. A connect without a device id (the old "Connect" / first-run default /
   "Other sources" with empty port) therefore succeeds by auto-picking the first device, but
   `config.deviceId` stays `null`. `remember_connected` stores that config as is.
2. A connect from the Detected list uses `deviceId = port name`. `store::same_identity` compares
   `driverId + deviceId + connection`, so `(null, {})` and `("/dev/ttyACM0", {})` are different
   identities, and a second entry is created.
3. `menuModel` (src/state/sourceEntries.ts) only dedupes detected devices against remembered
   entries whose `deviceId != null` (`remembered` set of `driver/deviceId`). The `null` entry never
   hides anything, and its title is the automatic label, equal to the detected label. Result: two
   rows, same text. (Even the port-keyed entry is fragile: a different port gives a new detected row.)

Underlying design flaw: **identity is the transient port name**, and an entry can have no identity
at all. Both are fixed by a stable device identity set by the driver, not the caller.

## Proposed design: stable device identity

### Backend
- **SA430 `device_id` = USB/device serial number** (e.g. `08FF41E50F8B3A34`), as the human asked.
  `discover` uses `port.serial_number()`; when a port exposes no serial, fall back to
  `port:<name>` (documented as unstable, labelled "SA430 on /dev/ttyX"). Port stays in `details`.
  Verify during implementation that the USB serial equals the calibration serial (labels in the
  store suggest yes: `open` builds its label from calibration, discovery from USB); if they ever
  differ, `open` must report the id it actually resolved and the store re-keys on it.
- `SourceDriver::open` resolves `device_id` -> port by scanning (`backend.scan()`); the typed
  `port` param remains for manual setup ("Add source"), and then the driver reports the device's
  serial after reading calibration.
- **`ActiveSource` gains `device_id: Option<String>`** (the resolved identity reported by `open`;
  `OpenedSource` gains the same field). `remember_connected` stores the *resolved* config
  (`device_id` filled in), so a connect without an id can no longer create an id-less entry for a
  device that has a serial. Drivers without devices (file, simulator) keep `None`. Rust type change
  -> `npm run bindings`.
- **Identity match** (`same_identity`): `driverId` + `deviceId` when `deviceId` is set (ignore
  `connection`, which is only a hint for finding the device); otherwise `driverId + connection`.
- **Port is a hint, not identity**: manual `connection.port` stays in the entry but is only used
  when the serial is not found by scan.

### Migration (load-time, in `ConfigStore::open`, schema stays v-compatible)
For each entry with `driverId = sa430` and a `deviceId` that is not a serial (starts with `/dev/`,
`COM`, or is `null`):
- If its `label` is `SA430 <serial>` (automatic label of the form the driver writes), set
  `deviceId = <serial>` and drop port-like `connection.port` into a hint.
- Merge entries that now share an identity: keep the one with a non-empty `name`, else the most
  recently used; carry over `lastUsedMs` max and settings of the most recently used; **never drop a
  user `name`**; fix `lastSourceId` if it pointed to a merged entry.
- Entries with no parsable serial (label `SA430 on /dev/ttyACM0`) stay as they are (`deviceId` =
  `port:<name>`).
- Write back once (atomically, with a `.bak` of the old file, per ADR 0006), and unit test with
  the exact two-entry store above. The migration is driver-agnostic in the store (needs a
  `SourceDriver::normalize_device_id(old_id, label) -> Option<String>` hook) so hardware
  knowledge (serials) stays in the driver crate; `ConfigStore::open` takes the registry's hook as
  a closure like `driver_available` already does.

### Same serial on another port
Because identity is the serial, the entry matches wherever the device appears: presence is
`present` if discovery returns that `deviceId` on any port; connecting resolves the current port by
scan. The entry's name, settings and history persist unchanged. Two different devices never
collide (different serials). Two ports reporting the *same* serial (cloned/blank serial): treat as
ambiguous - discovery marks them with `port:<name>` ids and the label shows the port.

### Renaming
`SavedSource.name` is the user override on the entry keyed by identity. Rename persists because the
entry is matched by `(driver, deviceId)` on rediscovery and the detected device is hidden in favour
of the remembered row (frontend: build the `remembered` set from the entry's `deviceId`, which now
is always set for devices; `menuModel` already does this once ids are stable). Frontend guard
(defence in depth): additionally hide a detected device when a remembered entry of the same driver
has the same automatic `label` and `deviceId == null`, so legacy rows can never double.

## Backend needs for the new dialog

### "Test connection" - `test_source(config: SourceConfig) -> TestResult`
- New `SessionManager::test_source(&self, config)` (spectrum-core, then thin Tauri command).
  Validates `driverId` (available) and connection params (`resolve_params`), **does not touch
  `shared` status, the worker or last_config**.
- **Does not disturb the active session**: if the session is connected/acquiring and the active
  source has the same identity (same `deviceId`, or same `connection.port`) return
  `TestResult::InUse` ("This analyzer is the active source and is working.") without opening it
  (a serial port cannot be opened twice). For a different device/port it is safe to open in
  parallel; opening runs on a short-lived thread with `OPEN_TIMEOUT`, then drops the source
  (`stop` + close) immediately. The command holds a small mutex so two tests cannot run at once;
  it does not take the `worker` lock (that is what `connect` uses to tear the session down).
- Result type (ts-rs): `{ ok: boolean, message: string, deviceId: string | null,
  label: string | null }` - on success the device label/serial (so the dialog can show
  "Found SA430 08FF41E50F8B3A34 on /dev/ttyACM0" and prefill the identity), on failure the
  backend's `SourceError` message (reusing `error_chain`). Never claims success without an
  `open` that read the calibration.
- Concurrency edge: a test while `Connecting` -> `InUse`-style "Busy, try again" result.

### "Add source" - `add_source(name: String, config: SourceConfig) -> SavedSource`
- Saves without connecting or touching the session or `last_source_id`.
- Validation in Rust: name required, trimmed, non-empty, <= `MAX_NAME_LENGTH`, driver available and
  not file/simulator-only (manual-setup driver with connection params), params valid per
  `resolve_params`. Duplicate identity (same driver + deviceId) -> error "That device is already in
  your sources as <name>" (offer rename instead; no silent duplicate). Without a known `deviceId`
  (user typed a port and did not test) it is allowed: identity `driverId + connection.port`; it is
  upgraded to the serial on first successful connect (the resolved-config rule above).
- Respects the 50-entry cap with the same eviction rule as `remember_connected` (or fails with the
  existing message).
- Store method `ConfigStore::add_source(name, config, driver_available)`; Tauri command registered
  in `src-tauri/src/lib.rs`; frontend `ipc/commands.ts` + `mockApi.ts`; `npm run bindings`.

## ADR / docs changes
- **New ADR 0010 "Stable device identity"**: serial as `deviceId`, resolved-config rule, identity
  match ignoring `connection`, load-time migration/merge, ambiguous-serial fallback.
- **ADR 0009**: amend consequence "SA430 deviceId is its serial port name ... follow-up" ->
  superseded by 0010; "Other sources" wording -> "Add source"; note that entries are now also
  created without connecting.
- **ADR 0006**: note one-time migration rewrite with backup.
- `docs/sources.md` (contract: `device_id` must be a stable hardware identity; `OpenedSource`
  reports it; `normalize_device_id`), `docs/file-formats.md` (migration), `docs/roadmap.md`
  (remove the stable id follow-up), `docs/user-guide.md`.

## Open questions for the human (PM to ask)
1. Merging legacy duplicates automatically (keeping name, newest settings): OK? (Proposed: yes.)
2. "Add source" with a port that was not tested: allow Save with a warning, or require a passing
   Test? (Proposed: allow; story says only name + valid params.)
3. Does the USB serial equal the calibration serial on this device? (To be verified with the real
   hardware in the first task.)
