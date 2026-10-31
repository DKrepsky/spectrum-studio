# Plan 001 (rework): stable identity, Add/Edit dialog, status glyphs, fixed widths

Status: planned 2026-10-31 on top of the uncommitted T1-T8 working tree. Inputs: `design.md` [REV3], `prototype/`
(human-approved), `story.md` Amendment 1, `investigation-duplicates.md`. Decision record:
`docs/adr/0010-stable-device-identity.md` (new), amendments to ADR 0009 and 0006 (done).
`plan.md` and `tasks/T1..T8.md` stay as history: T1-T7 are built and partly superseded (marked in each file), T8 is
superseded by T16.

## 1. What changes, in one paragraph

Identity moves from the transient port to the device (SA430: serial number); the driver reports the identity it
resolved, the store keys on it, merges legacy duplicates on load (with a backup) and on connect, and exposes
`add_source` / `update_source` / `test_source`. The UI drops "Other sources…" and inline rename for one Add/Edit dialog,
replaces text glyphs with the circle set (design 2.0), and rebuilds the row/button layout on fixed widths (2.1). The
session lifecycle, remembering-on-connect, forget/undo, scanning and the menu keyboard model are unchanged.

## 2. Verification FIRST (task T10, step 1; the fallback is decided so T11-T16 are not blocked)

**USB serial must equal the calibration serial on the real SA430.** `discover` reads `Port::serial_number()` (USB
descriptor); `open` reads `calibration().serial_number`. Evidence so far: this machine's `udevadm` shows
`ID_SERIAL_SHORT=08FF41E50F8B3A34` and the store label written by `open` is `SA430 08FF41E50F8B3A34` (equal), but that
is one device read through two channels by eye. The developer adds an `#[ignore]` hardware test in
`crates/spectrum-driver-sa430/tests/hardware.rs` (run with `SPECTRUM_E2E_SA430=1 cargo test -p spectrum-driver-sa430
-- --ignored`) that scans, opens the first port and asserts `port.serial_number() == calibration serial` (trimmed).
If it passes: proceed. **If it fails or the USB serial is absent: STOP the identity work and report to the PM with the
two values**; fallback already decided (ADR 0010, alternatives): `open` derives `device_id` from the scan data of the
port it opened (USB serial, else calibration serial, else `port:`), and the equality is documented instead.

## 3. Contract

### 3.1 Rust types (all exported with ts-rs; `npm run bindings` after T9 and T12)

```rust
// model/source.rs
DeviceDescriptor { driver_id, device_id /* STABLE identity, see ADR 0010 */, label,
                   location: Option<String> /* NEW, e.g. "/dev/ttyACM0": where it is attached now (display + hint) */,
                   details }
pub struct SourceUpdate {              // NEW
    pub name: String,                  // trimmed, 1..=60 chars
    pub device_id: Option<String>,     // None = keep the identity; Some = (re)bind to this identity
    pub connection: ParamMap,          // the new connection hint / manual parameters
}
pub struct SourceTestResult {          // NEW
    pub ok: bool,
    pub message: String,               // success: "Connection OK. <driver name> found." ; failure: backend message verbatim
    pub device_id: Option<String>,     // identity read from the device (ok only)
    pub label: Option<String>,         // "SA430 08FF41E50F8B3A34" (ok only)
    pub in_use: bool,                  // true when the port belongs to the active source (ok = false)
}
// store.rs: SavedSource unchanged. SOURCES_SCHEMA_VERSION = 3.
// ActiveSource, SessionStatus, Preferences, SourceList, DiscoveryResult: unchanged.
```

Rust-only (not exported):

```rust
pub struct OpenedSource { source, label, simulated,
    pub device_id: Option<String>,     // NEW: identity the driver actually opened (None for file/simulator)
    pub connection: ParamMap,          // NEW: connection params that reach it now (SA430: {"port": "/dev/ttyACM0"}); empty = nothing to refresh
}
trait SourceDriver {
    // NEW, default returns None. Called only by the store migration with the stored id (if any) and automatic label.
    // Returns the new stable id, or None to leave the entry as it is. May enumerate devices, never open them.
    fn normalize_device_id(&self, device_id: Option<&str>, label: &str) -> Option<String> { None }
}
DriverRegistry::normalize_device_id(driver_id, device_id, label) -> Option<String>      // passthrough
ConfigStore::open(dir)                       // unchanged signature = no-op normalizer (tests, tools)
ConfigStore::open_with(dir, normalize: &dyn Fn(&str /*driver id*/, Option<&str>, &str /*label*/) -> Option<String>)
```

The session worker stores the resolved identity: `ActiveSource.config.device_id = opened.device_id.or(config.device_id)`
and `ActiveSource.config.connection` = given connection overlaid with `opened.connection`. (`ActiveSource` has no new
field; its `config` is now the *resolved* config.)

### 3.2 Commands (src-tauri/src/commands.rs; snake_case, camelCase args)

| Command | Args | Returns | Behaviour |
| --- | --- | --- | --- |
| `add_source` | `name: String, config: SourceConfig` | `SavedSource` | Creates a record, no connect, no session/`lastSourceId` change. Also used by Edit > Save on a *detected* device. Errors (message verbatim in UI): empty/too long name; name used by another record (case-insensitive, vs `name` or `label`); driver not registered/`Available`; driver internal or file ("Use Open file…"); `resolve_params` failure; for a driver with discovery and no `deviceId` every Text connection param must be non-empty (a record needs a handle); identity (driver+deviceId, or driver+connection when no id) already remembered -> `This device is already in Your sources as "<name>".`; 200 cap (same eviction as `remember_connected`). `settings` are cleared. Returns the record. |
| `update_source` | `id: String, update: SourceUpdate` | `SavedSource` | Edits by id. Name rules as above excluding the record itself. `device_id: Some(x)` rebinds; error if another record has `(driver, x)`. Internal/file drivers: `connection`/`device_id` must equal the stored ones, else `The file cannot be changed.` / `The simulator has no settings.` (rename only). **Lock**: if the session is `Connecting`/`Connected`/`Acquiring`/`Disconnecting` and the active source's resolved identity matches this record (same driver+deviceId, or driver+connection when no id), any change of `connection` or identity is rejected with `Disconnect first to change the connection settings.`; name-only changes are applied. Unknown id: `That source no longer exists.` Settings, `created_ms` kept; `updated_ms` set; `last_used_ms` NOT changed. |
| `test_source` | `driver_id: String, connection: ParamMap` | `SourceTestResult` | Opens with no `device_id` (probe of exactly the typed parameters), reads identity, closes. Never touches `shared` status, the worker lock, `last_config` or the store. Expected failures are `ok: false` results, not command errors; only invalid arguments (unknown/unavailable driver, `resolve_params` error) are `Err`. In-use: if the session is connecting/connected/acquiring and any text value of `connection` equals a text value of the active source's `config.connection`, return `ok:false, in_use:true`, message `<value> is in use by the active source. Stop and disconnect it first.` without opening. State `Connecting`/`Disconnecting`: `ok:false`, `Busy: a connection is in progress. Try again in a moment.` One test at a time (second returns the Busy message). Timeout 8 s (`ok:false`, `The device did not answer in time.`); the abandoned open finishes and drops on its own thread. |
| `rename_source` | | | **REMOVED** (superseded by `update_source`). |
| `connect_remembered`, `connect_source`, `forget_source`, `restore_source`, `list_sources`, `discover_all`, others | | | unchanged signatures. `restore_source` additionally rejects a record whose identity is already remembered ("That source already exists."). |

`ipc/commands.ts`: add `addSource(name, config)`, `updateSource(id, update)`, `testSource(driverId, connection)`;
remove `renameSource`. After `addSource`/`updateSource` the UI calls `listSources()`.

Connect behaviour after this plan (driver contract, SA430): resolve the port by `config.device_id` (scan; `port:` ids use the
name), else by the connection hint, else (no id, no hint) the first device found; open; read the serial; **if an expected
serial was given and the found one differs, fail** with `Expected SA430 <expected> but <port> is SA430 <found>. Open Edit source and test the connection to use this one, or choose the right port.` The
store then writes the *resolved* identity and port. This keeps the PM decision (an untested port edit that reaches a
different device fails with expected vs found) with one refinement the PM should know: if the *original* device is still
attached, identity wins over the edited hint and that device is connected (its row's port is refreshed). The error
appears only when the original device cannot be found by scan.

## 4. Migration (ADR 0010 point 5)

Trigger: `sources.json` with `version < 3` (including v1/v2 and the user's real file). `version > 3`: no migration, no
rewrite on load (known limitation stays). Steps in `ConfigStore::open_with`, in order, all in memory first:
1. existing `normalize()` (v1: `last_used_ms`, long names truncated);
2. `normalize_device_id` for every entry (hook per driver): SA430 returns `Some(serial)` when the label is `SA430 <serial>`,
   else for an old port-path id looks the path up in the current scan (`Port::name` -> serial), else `Some("port:<path>")`;
   a legacy port-path id also becomes the `connection.port` hint when none is set. Entries with `deviceId: null` and no
   parsable label stay unchanged (identity driver+connection, gets a serial on first connect).
3. merge groups: device entries sharing `(driver, deviceId)`; non-device entries sharing `(driver, connection, displayed name)`.
   Survivor rule: the entry with a non-empty `name`, most recently used among them; none named -> most recently used. The
   survivor keeps its `id`, the max `last_used_ms`, the min `created_ms`, the newest entry's `config.settings`, `label`
   from the newest non-empty. `preferences.lastSourceId` pointing at a merged-away id is repointed to the survivor.
   If merged entries had different non-empty names, push a store warning: `Merged duplicate entries for <label>; the name
   "<lost>" is kept only in the backup <file>.`
4. if anything changed or `version < 3`: copy the old file to `sources.pre-v3-<epoch ms>.json` (never overwrite), write
   `sources.json` atomically as v3, then write preferences if `lastSourceId` changed. If the backup or write fails: warn
   (`Could not back up/save ...`), keep the in-memory result, `sources_unsaved = true` so the next commit retries (and
   retries the backup first). Entries of unknown/unavailable drivers pass through byte-equivalent (they have no hook).

Tests (required, T11): (a) the exact two-entry store from `investigation-duplicates.md` (null/{} and "/dev/ttyACM0"/{}, same
label) -> one entry with `deviceId = "08FF41E50F8B3A34"`, `connection.port = "/dev/ttyACM0"`, backup file exists with the
original bytes, reload gives the same single entry (idempotent), `lastSourceId` repointed; (b) named + unnamed duplicate keeps the
name; two different names keep the newer one and produce a warning naming the backup; (c) two simulator entries with
different names and settings are NOT merged; two identical (same name) are; (d) a ghost-driver and a planned-driver entry survive
byte-equal; (e) v3 file loads without backup or rewrite; (f) a v99 file is not touched; (g) failing backup (read-only dir) keeps
working in memory and warns; (h) the hook is called only for entries that need it; (i) merge-on-connect: a record with an
untested port connects, resolves to a serial owned by another record -> one record remains, user's name kept.

## 5. Frontend design of record

- **State** (`sources.ts`, `sourceEntries.ts`, `session.ts`): drop `rename`; add `addSource`, `updateSource`, `testSource`
  passthroughs (return `{ok,...}`/throw message) and refresh the list after mutation. `sameIdentity` (sourceConfig.ts) becomes
  `driverId` + `deviceId` when both set, else `driverId` + `connection` (mirror of the Rust rule; needed because
  `ActiveSource.config` is now resolved). After any connect, if `active.id` is no longer in the list (a merge happened) the
  active entry is re-adopted from `list.activeId`. `YourRow` gains `port: string | null` (scan `location` when present, else the
  record's `connection.port`) and `locked: boolean` helpers live in `sourceEntries.ts` (`isActiveBusy`). `menuModel` already
  hides a detected device that matches a remembered `(driver, deviceId)`; add the test "renamed + replugged on another port is
  one row with the new port and the old name".
- **Row model contract used by the menu and dialog tasks** (T13 delivers, T14/T15 consume): `YourRow {entry, key, title, transport, presence, active, port}`,
  `DetectedRow {device, key, title, transport, port}`, `statusOf(row, activeStatus, failedKey)` returns `EntryStatus`
  (`connected|acquiring|connecting|disconnecting|failed|absent|idle`) unchanged names.
- **Dialog contract** (T13 creates a compiling stub, T15 implements, T14 opens it):
  ```ts
  export type DialogTarget =
    | { mode: 'add' }
    | { mode: 'edit'; entry: SavedSource }                     // remembered row
    | { mode: 'edit-detected'; device: DeviceDescriptor };     // detected, not remembered
  export interface SourceDialogProps {
    target: DialogTarget;
    onClose(result: { saved: SavedSource | null; forgotten: boolean }): void; // menu re-opens, highlights `saved`
    returnFocusTo: RefObject<HTMLElement | null>;                              // the source button
  }
  export function SourceDialog(props: SourceDialogProps): JSX.Element
  ```
  The dialog calls the store (`useSources`) for add/update/forget/test, `useSession` for state (lock), `useSources.drivers` for the
  driver list; it renders connection params with `ParamForm`. All validation is repeated in Rust; the dialog only pre-checks.
- **Dialog param rule** (design 4.1): every connection param of the chosen driver is treated as required in the dialog (a record
  needs a handle), even if its `ParamSpec.required` is false, because the same spec serves connect-from-detected where the
  port is empty. SA430 spec help becomes `Path of the device's serial port, for example /dev/ttyACM0.` (T10).
- **Menu** (T14): row = CSS grid `18px | minmax(0,1fr) | 64px` implemented on the row `button` (`.source-item`), the actions
  slot absolutely positioned in column 3 line 2 of `.source-row` (position: relative); source button `min-width:150px;
  max-width:280px`; popover width 360. New CSS lives in new `src/styles/source.css` (moved out of `app.css`), dialog CSS in
  `src/styles/sourceDialog.css`. Glyphs are `<span class="src-dot" data-status=...>` drawn with CSS (no text glyph), `aria-hidden`,
  with `prefers-reduced-motion` handling. `Add source…` replaces `Other sources…` (view `'other'` removed; the inline `SourceForm`
  stays only for detected/file entries missing a required parameter). Row action `✎` (`source-edit`, `F2`) opens the dialog;
  `×` forgets (`source-forget`), `Delete` forgets. Drivers shown in the Add dialog = `otherDrivers(drivers)` (unchanged rule).
- **SA430 badge**: driver `transport` changes from `Serial` to `Usb` (T10), so the badge reads `USB` as designed.

## 6. Tasks, order, parallelism

| Task | Scope | Owns (disjoint) | Depends | Runs with |
| --- | --- | --- | --- | --- |
| T9 | Contract: new Rust types, `OpenedSource` fields, `normalize_device_id` hook, worker stores resolved config, bindings | `crates/spectrum-core/src/{model/source.rs,sources/mod.rs,sources/registry.rs,sources/simulator/**,sources/files.rs,sources/planned.rs,session/worker.rs}`, `crates/spectrum-core/tests/{session,files}.rs`, `crates/spectrum-driver-sa430/src/lib.rs` (mechanical literal only), `src/bindings/**` | - | FIRST (small, mechanical) |
| T10 | SA430 identity + hardware verification (step 1, report immediately if it fails) | `crates/spectrum-driver-sa430/**` | T9 | T11, T13 |
| T11 | Store: identity match, migration/merge/backup, add/update, merge-on-connect, remove rename | `crates/spectrum-core/src/{store.rs,remember.rs}`, `crates/spectrum-core/tests/remember.rs`, `e2e/fixtures/seed/migration/**` | T9 | T10, T13 |
| T12 | `test_source`, Tauri commands, wiring (`open_with` + registry hook), bindings | `crates/spectrum-core/src/session/mod.rs`, `crates/spectrum-core/tests/probe.rs`, `src-tauri/src/**` | T9, T10, T11 | T13, T14, T15 |
| T13 | Frontend IPC, state, mock, fixtures, dialog stub | `src/ipc/**`, `src/state/**`, `src/test/**`, `src/components/source/SourceDialog.tsx` (stub only) | T9 (bindings) | T10, T11, T12 |
| T14 | Source button, menu, glyphs, fixed widths, Add source… / Edit entry points, CSS | `src/components/source/{SourceButton,SourceMenu,status,useMenuKeys,menuState}.*`, `SourceMenu.test.tsx`, `SourceButton.test.tsx`, `src/styles/{source.css,app.css}`, `src/components/{Toolbar,NoticeBanner}.*`, `src/App.tsx` | T13 | T15, T12 |
| T15 | Add/Edit source dialog | `src/components/source/{SourceDialog.tsx,SourceDialog.test.tsx,useFocusTrap.ts}`, `src/styles/sourceDialog.css` | T13 | T14, T12 |
| T16 | e2e, visual guard (replaces T8), screenshots, docs, roadmap | `e2e/**` (except the migration seed owned by T11), `docs/**` (except `docs/adr/`), `README.md` | T12, T14, T15 | last |

Merge order: T9 -> (T10, T11, T13) -> (T12, T14, T15) -> T16. `src/bindings` is regenerated by T9 and T12 only; T9 already defines
every new exported type, so the T12 regeneration is expected to be empty (T12 must still run `npm run bindings` and commit any diff).
Until T12 lands, the frontend runs against `mockApi` only (Vitest); the real commands are first exercised in T16.

## 7. Risks

1. **USB serial != calibration serial** (section 2). Gate in T10 step 1; fallback decided.
2. `ActiveSource.config` becoming the resolved config can break UI code that compares configs (`session.ts receiveStatus`,
   `sameConfig`). Mitigation: `sameIdentity` rule in section 5, tests in T13; e2e persistence/reconnect specs cover it.
3. Migration data loss. Mitigation: backup-before-write, never-merge-presets rule, idempotence test, ghost entries byte-equal,
   store warning when a name is dropped. Residual: BUG-2 (unknown JSON fields dropped by the struct round trip) still exists;
   the backup holds them.
4. `test_source` opens a serial port in parallel with an active session: serial ports are exclusive, so opening the *same* port
   is refused up front (value compare); a different port is safe. A hung device blocks only the probe thread (8 s timeout).
5. Menu CSS regressions: the row is a button with a grid and an absolutely positioned actions slot; focus ring and hover must not
   shift layout. Mitigation: layout asserted with real measurements in the T16 e2e guard (jsdom cannot measure).
6. Two-row regressions for legacy port-only entries when the device is not attached at startup (id becomes `port:/dev/ttyACMx`,
   later the device shows with its serial): the entry heals on its first connect (resolved identity) but shows as `Not detected`
   plus a `New` row until then. Documented limitation; the human's real data has labels, so it is migrated by serial.
7. Dialog accessibility (focus trap, return focus, locked fields skipped in tab order). Tested in T15 with a keyboard test; T16 checks
   focus in the e2e.
8. Scope: driver `transport` change to `Usb` is metadata only; any consumer matching on `Transport::Serial` for SA430 (grep done: none
   other than tests/menu fixtures).

## 8. Test plan (summary; details in each task)

- **Rust**: SA430 scripted-backend tests (ids by serial, `port:` fallback, duplicate serial ambiguity, resolve by identity on a new port,
  hint fallback, expected-vs-found failure, mismatch message wording, normalize hook cases); hardware `#[ignore]` test (section 2);
  store migration/merge/backup tests (section 4) and add/update validation tests (each error string above, lock rule, rebind duplicate,
  internal/file rename-only, case-insensitive name uniqueness excluding self, cap eviction, restore duplicate identity); session tests
  `test_source` (ok, fail, in-use, busy, does not change `SessionStatus.revision`, does not interrupt acquisition of another source);
  `tests/session.rs` (resolved config written to status).
- **Vitest**: `sourceEntries` (renamed device replugged = one row), `sources` store (add/update/test, refresh, merge re-adopt), `sameIdentity`;
  `SourceMenu`/`SourceButton` structure: each row has `.src-dot[data-status]` + exactly one badge element in the third column with the shared
  `src-badge` class (also for `Built-in`), line 2 always present, actions inside the row but `visibility`-hidden via CSS class not DOM removal,
  glyph element is `aria-hidden`, accessible name carries state, `Add source…` present and `Other sources…` absent, `F2`/`✎` open the dialog,
  `Delete`/`×` forget; **CSS contract test** (`source.css.test.ts`, reads the CSS text) asserts `grid-template-columns: 18px minmax(0, 1fr) 64px`,
  `.src-badge{width:64px}`, button `min-width:150px;max-width:280px`, popover `width:360px`, reduced-motion block (jsdom cannot lay out, so
  numbers are guarded as text here and as pixels in e2e); `SourceDialog` (modes, locked driver, Test result variants ok/mismatch/duplicate/fail/in-use,
  Save enabled/disabled rules, no test required, name rules, connected lock, Forget, Escape/Enter, focus trap and return, detected mode, file/simulator
  variants).
- **e2e / visual (T16)**: real-WebKit layout assertions at 1024 and 1280 (name column left/right x identical across rows with USB/File/Built-in
  badges, badge width 64, hover actions change no rect, button <= 280, nothing `scrollWidth > clientWidth` unless `data-truncated` + `title`, popover and
  dialog inside the window), screenshots of every REV3 state, Add/Edit flows in the real app, migration spec with the real two-entry store, SA430
  hardware spec extended (single row, rename survives restart). QA then looks at the screenshots (qa.md rules).

## 9. Docs

`docs/sources.md` (identity contract, `OpenedSource` fields, `normalize_device_id`, `DeviceDescriptor.location`, probe/test semantics),
`docs/file-formats.md` (sources.json v3, backup file), `docs/user-guide.md` (Add/Edit source, status circles, one row per device),
`docs/architecture.md` (command list), `docs/roadmap.md` (remove "stable device id" follow-up, BUG-3 fixed, keep BUG-2), README screenshots.
