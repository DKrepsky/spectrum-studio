# Plan 001: Simplify the source journey

Status: planned 2026-10-31. Decision record: `docs/adr/0009-automatic-source-memory.md`.
**Rework (2026-10-31):** see `plan-rework.md` (T9-T16). Where the two conflict, `plan-rework.md` wins (identity = `driverId + deviceId`; "Other sources…" and `rename_source` removed; ADR 0010).

## 1. Approach

The session already stops/joins the old worker inside `SessionManager::connect`, so "pick = connect"
needs no session lifecycle change. The work is:
1. **Backend remembering** in `spectrum-core::store` (auto-upsert on connect, settings write-back, forget/restore/rename, migration, hidden entries), plus a `discover_all` aggregation.
2. **IPC**: a small command set that replaces save/delete/list-saved.
3. **Frontend**: a new sources state slice and a `SourceButton` + `SourceMenu` (+ inline form) replacing `SourceSelector`, `SourceManager` and Connect/Disconnect/Switch.
4. **e2e + docs**.

No new dependencies (no popover/menu library: a small hand-rolled menu with roving focus).

## 2. IPC contract (the interface between backend and frontend tasks)

Rust types live in `spectrum-core` and are exported by ts-rs (`npm run bindings`). TS names = Rust names, camelCase fields.

### Types
```rust
// store.rs  (extended; all new fields serde(default) so v1 files load)
pub struct SavedSource {
    pub id: String,
    pub name: String,        // user override; "" = none (UI shows `label`). <= 60 chars when set by Rename.
    pub label: String,       // automatic name captured at connect (ActiveSource.device_label); "" for migrated entries
    pub config: SourceConfig,// connection + last effective settings
    pub created_ms: f64,
    pub updated_ms: f64,
    pub last_used_ms: f64,   // ordering key, most recent first
}
pub struct SourceList { pub sources: Vec<SavedSource>, pub active_id: Option<String> }
//   sources: only entries whose driver is registered AND DriverStatus::Available, sorted by last_used_ms desc.
//   active_id: preferences.last_source_id if that entry is in `sources`, else None.
pub struct Preferences { ..., pub last_source: Option<SourceConfig> /* deprecated, migrated */, pub last_source_id: Option<String> }

// model/source.rs
pub struct DiscoveryResult { pub driver_id: String, pub devices: Vec<DeviceDescriptor>, pub error: Option<String> }
```

### Commands (src-tauri/src/commands.rs; snake_case command, camelCase args)
| Command | Args | Returns | Behaviour |
| --- | --- | --- | --- |
| `list_drivers` | - | `DriverInfo[]` | unchanged (Planned still returned; UI filters `status === 'available'`) |
| `list_sources` | - | `SourceList` | replaces `list_saved_sources` |
| `discover_all` | - | `DiscoveryResult[]` | one entry per available driver with `supportsDiscovery` and transport not `internal`/`file`; per-driver `error` instead of failing; serialised (one scan at a time) |
| `connect_remembered` | `id: string` | `SessionStatus` | load entry config from store, connect (atomic: stops old source), on success touch `lastUsedMs`, store effective settings, set `lastSourceId`; sets `lastSourceId = id` at attempt start. Stale-settings fallback (section 6). Error = backend message (as today). |
| `connect_source` | `config: SourceConfig` | `SessionStatus` | connect ad hoc config; on success upsert by identity (new id or touch existing), store label + effective settings, set `lastSourceId`. Failure remembers nothing. |
| `disconnect_source` | - | null | unchanged (selection kept) |
| `apply_source_settings` | `patch` | `SourceSettings` | unchanged result; on success also write effective settings to the entry `preferences.lastSourceId` (no-op if missing; persistence failure is logged, not an error) |
| `rename_source` | `id, name` | `SourceList` | trim; empty clears the override; > 60 chars rejected; unknown id error |
| `forget_source` | `id` | `SourceList` | removes entry (does not disconnect, does not clear `lastSourceId`) |
| `restore_source` | `source: SavedSource` | `SourceList` | Undo: validates and re-inserts the record with its id/timestamps; error if id exists |
| removed | | | `save_source`, `delete_saved_source`, `list_saved_sources` |

`ipc/commands.ts` wrappers: `listSources`, `discoverAll`, `connectRemembered(id)`, `connectSource(config)`, `renameSource`, `forgetSource`, `restoreSource`.
After any connect (success or failure) the UI calls `listSources()` to refresh. Mutating source commands return the new `SourceList`.

Identity of a remembered source: `driverId` + `deviceId` + `connection` (ParamMap equality); settings excluded. Legacy duplicates (same identity, different names/settings) are kept as separate rows; `connect_source` upserts onto the most recently used match. Connect by id targets exactly that entry.

## 3. Answers to design section 10

1. **Remembering/migration**: as above. `SavedSource` reused with `label` and `last_used_ms` added; `sources.json` v2; v1 loads with `last_used_ms = updated_ms`, `label = ""`, names preserved. Upsert on connect, settings write-back on `apply_source_settings`, forget/rename/restore commands. Undo = `restore_source` with the record the UI kept. The 200-entry cap evicts the least recently used entry of an *available* driver on insert (never a hidden one, never an error on connect); if none is evictable the connect still succeeds and a warning is logged.
2. **Scanning**: `discover_all` as specified. Polling only while the menu is open, single-flight in the UI (no new request while one is pending). It runs on the blocking pool and does not take the session worker lock, so it cannot block or stall acquisition. Contract for drivers: `discover` only enumerates (udev/OS listing), never opens or probes a device; documented in `docs/sources.md`; T1 must read the SA430 `discover` path and confirm (the real device check is a QA/manual item). We do not skip the active device: it is listed, which is what lets the UI mark its remembered entry present.
3. **Present/absent**: match `driverId + deviceId`. Only entries whose driver has `supportsDiscovery` and has a `deviceId` can be "Not detected", and only after a scan of that driver succeeded; before the first scan or after a scan error they render as idle. SA430's `deviceId` is its port name (may change on replug): known limitation, follow-up, not fixed here.
4. **Atomic pick**: already atomic in `SessionManager::connect`. Two commands (`connect_remembered`, `connect_source`) so the UI never sends stale settings for a remembered entry. No new session code.
5. **Unknown/unavailable driver**: kept in `sources.json` untouched (store is driver-agnostic and rewrites them verbatim), omitted by `list_sources`. A pure function `store::connectable(all, drivers)` does the filtering (unit-testable).
6. **Default names**: deviated from "UI derives". The backend captures `label` from `ActiveSource.device_label` at connect (only place that knows the real device label). UI shows `name.trim() || label || fallback`, where fallback (migrated entries, `label == ""`) = `<driver name> · <file basename | deviceId | host:port>` built from the driver info and connection params. UX identical to design.
7. **Last active**: persisted as `preferences.lastSourceId` (cheap: one field in the existing preferences write). Restored as selection, never auto-connected. Existing `lastSource` is migrated at load: matching entry reused or a new entry created, `lastSourceId` set, `lastSource` cleared.
8. **Ctrl+K**: no global shortcuts exist in `tauri.conf.json`/capabilities and WebKitGTK has no default for it. Use `Ctrl+K`, handled in `App` via a `keydown` listener that calls `preventDefault`.

### Deviations from design.md (and UX effect)
- **Other sources…** follows the human-approved design exactly (no deviation): it lists only available drivers that are not file/simulator and have connection params, is hidden when there are none, and a single driver skips straight to its form. The simulator is reached only via the Signal simulator row or Your sources; file drivers only via Open file… (raw IQ with extra required params uses the inline form after Open file…). Testability of failures and typed paths comes from seeding `sources.json` before launch (section 8 "e2e seeding"), not from extra UI.
- **Run with no remembered entry for the active source** (it was forgotten, then Disconnect, then Run) reconnects via `connect_source(config)` and thereby re-remembers it. Run counts as "used again".
- **Reconnect** (NoticeBanner) calls `connect_remembered(activeId)` when the active source has an id (restores latest settings), else `connect_source(lastConfig)`.
- **Presence "unknown"** state (before the first scan / scan error) renders as idle, not "Not detected".
- A failed pick of a *new* (not yet remembered) source: the UI keeps the attempted entry as `active` in memory (button shows its name, `✕`, pill Disconnected). It is not persisted.

## 4. Modules and files

**Rust core** (`crates/spectrum-core`): `src/store.rs` (SavedSource, SourceList, migration, remember/forget/restore/rename/update-settings, preferences `last_source_id`, `connectable`), `src/model/source.rs` (DiscoveryResult), `src/session/mod.rs` (`discover_all`), `src/sources/registry.rs` (optional helper), `src/lib.rs` re-exports. Version constants: `SOURCES_SCHEMA_VERSION = 2`; preferences stay v1 (additive field).
**Tauri shell** (`src-tauri/src/commands.rs`, `lib.rs`): command set above. Capability file stays (`dialog:allow-open` still used by Open file…).
**Bindings**: regenerate (`SavedSource`, `Preferences` changed; `SourceList`, `DiscoveryResult` new). Commit them.
**Frontend** (`src/`): `ipc/commands.ts`, `test/mockApi.ts`, `state/session.ts` (drop `selectedConfig`, `select`, `savedSources`, save/delete; connect actions), new `state/sources.ts` (menu/discovery/forget state), `state/sourceEntries.ts` (pure helpers, tested), `state/sourceConfig.ts` (trim to `toParamMap`, `sameConfig`), new `components/source/` (`SourceButton`, `SourceMenu`, `SourceForm`, `useMenuKeys`), `Toolbar.tsx`, `App.tsx`, `NoticeBanner.tsx`, `panels/SourcePanel.tsx` (hint text), `styles/app.css`. Delete `components/SourceSelector.tsx`, `components/sources/*` (move `TRANSPORT_LABEL` and `fileDriverFor` into `state/sourceEntries.ts`).
**e2e**: `helpers.ts` (new `selectSource`, `ensureDisconnected` via menu), all specs, `e2e/tools/screenshot.ts`.
**Docs**: `docs/user-guide.md`, `docs/sources.md`, `docs/roadmap.md`, `docs/architecture.md` (persistence/IPC lines if they mention saved sources), ADR 0009 (done).

## 5. Frontend contract (T3 provides, T4 consumes)

`useSession` (existing store) keeps `status`, `drivers`, `busy`, `commandError`, `info`, `run`, `stop`, `start`, `disconnect`, `applySettings`, ... and gains:
- `connectTo(target: ConnectTarget): Promise<boolean>` where `ConnectTarget = {type:'remembered', id:string} | {type:'config', config:SourceConfig, title?:string}`. Sets `busy='connecting'`, calls the right command, then `listSources()`, returns false on error (message in `commandError` as today). Sets the `active` entry synchronously to the target (so the button shows the target name while Connecting) and the failed marker on error.
- `run()` : `connectTo(active)` if state is not connected/acquiring, then `start()`. No-op when `active == null`.
- Removed: `selectedConfig`, `select`, `connect`, `savedSources`, `refreshSavedSources`, `saveSource`, `deleteSavedSource`.

`useSources` (new, `state/sources.ts`):
```ts
interface ActiveEntry { id: string | null; title: string; config: SourceConfig }
interface SourcesStore {
  list: SavedSource[]; activeId: string | null;      // from SourceList
  active: ActiveEntry | null;                        // toolbar name; null = "Choose a source"
  discovery: { results: DiscoveryResult[]; scanned: boolean; scanning: boolean };
  failed: string | null;                             // row key of the last failed pick (cleared on next pick/success)
  forgotten: SavedSource | null;                     // for the 5 s Undo toast
  init(): Promise<void>;                             // listSources -> active from activeId (never connects)
  refresh(): Promise<void>;
  startScanning(): () => void;                       // scan now + every 3 s, single-flight; returns stop fn; silent updates
  rename(id, name): Promise<boolean>; forget(id): Promise<void>; undoForget(): Promise<void>;
}
```
Pure helpers in `state/sourceEntries.ts`: `rowTitle(entry, drivers)`, `rowKey`, `visibleDrivers`, `menuModel(list, discovery, drivers, activeId)` (yours/detected/simulatorInFixedBlock/presence per row), `otherDrivers(drivers)` (available, transport not `internal`/`file`, with at least one connection param), `fileDriverFor(path)`, `splitConnectionParams(specs, values)` (required-missing first, optional behind Show more), `TRANSPORT_LABEL`.

Keys: remembered row `source-entry-<id>`; detected row key `<driverId>/<deviceId>`.

## 6. Error handling and validation (Rust)
- All inputs validated in Rust: `rename_source` (length, trim), `restore_source` (name length, config driver id non-empty, `last_used_ms` finite, id not present), `connect_*` keep `resolve_params` validation. Store loads still validate names but now allow empty `name`; entries are never discarded for a bad name individually (a name > 80 chars is truncated on load, keep the whole file rather than resetting it).
- Persistence failures after a successful connect/settings change never fail the command (log with `tracing::warn`), as `connect_source` does today for `last_source`.
- **Stale settings**: `connect_remembered` retries once with `settings` cleared if the failure is a rejected-settings error (`SessionError::Source` with `SourceErrorKind::InvalidSettings`) and the entry had non-empty settings; success then stores effective defaults. Test with a scripted driver.
- All error text is the backend message verbatim; the UI prefixes `Connection failed: ` only in the inline form.
- Migration safety: v1 load never rewrites the file; the first mutation writes v2 atomically. Entries of unknown/unavailable drivers are carried through every rewrite byte-equivalent (struct round trip including `config`).

## 7. Risks
1. SA430 `discover` while the device is open/acquiring: must be enumeration only (verify in T1; real-hardware spot check by QA with `sa430.e2e.ts`).
2. Menu accessibility (roving focus, type-ahead, Escape/Tab focus return) is the largest UI risk; keep logic in one `useMenuKeys` hook with tests.
3. Race: user picks A, then B while A connects. Menu entries are disabled while `busy`; backend serialises via the worker lock. Test that the UI ignores clicks while busy.
4. `Preferences`/`SavedSource` shape change: old frontend and new backend are never mixed (single binary), but old *files* must load: covered by fixtures.
5. Removing the Sources dialog removes the only path to remove-all/export of sources; acceptable per story.
6. e2e `persistence.e2e.ts` currently restarts the app; keep it, rewritten around auto-remember.
7. Forgotten active source is re-remembered by Run (documented deviation).

## 8. Test plan
**Rust (spectrum-core `store.rs` tests and `tests/`)**
- v1 `sources.json` fixture (named entries, unknown driver `ghost`, planned driver `soapysdr`) loads; after `forget` of another entry and a rewrite, the ghost/planned entries are still present verbatim; `connectable()` hides them; `list` order by `last_used_ms`.
- v1 `preferences.json` with `lastSource` -> entry created/reused, `lastSourceId` set, `lastSource` cleared.
- upsert: new identity creates; same identity touches (same id, `last_used_ms` increases, settings = effective); different `deviceId` creates a second; legacy duplicates stay separate; connect-by-id updates that entry only; cap eviction removes LRU of an available driver, never a hidden one.
- `update_source_settings` writes effective settings; missing id is a no-op.
- rename (trim, clear, 60 limit, unknown id), forget (returns record), restore (round trip equals original; duplicate id rejected), name validation allows empty on load.
- `discover_all` (session test with scripted drivers): skips planned/internal/file/no-discovery drivers, reports a failing driver's error and still returns the others, does not block while a source is acquiring.
- Stale-settings fallback (scripted driver that rejects settings first, accepts defaults).
- Session test (`tests/`): connect A running -> connect_remembered B: A stopped, B connected, store updated; failed connect remembers nothing and leaves previous entries intact.

**Frontend (Vitest, `mockApi`)**
- `sourceEntries`: titles/fallbacks, menu model (dedupe of detected vs remembered, simulator fixed-row rule, presence unknown vs absent, planned filtered everywhere, Other sources list incl. single-driver shortcut), `fileDriverFor`, param splitting.
- `sources` store: init without connecting, scan polling single-flight and stop on close (fake timers), forget + 5 s undo, rename revert.
- `SourceMenu`/`SourceButton` component tests: first launch (button label, Run disabled, no Connect/Switch/Sources… in the DOM), pick connects and shows target name while connecting, failure keeps Disconnected and shows backend message and `Failed`, Disconnect item enabled only when connected, entries aria-disabled while busy, keyboard (open, arrows, Home/End, Enter, Escape, Tab), Forget/Undo, Rename, inline form (required first, Show more, error `role=alert`, Back/Escape), Open file… calls dialog and picks driver by extension, raw IQ opens form with path prefilled, Planned drivers never rendered.
- `Toolbar` test rewritten; `NoticeBanner` test updated (no `Sources…`; Reconnect uses id).
- Existing `ParamForm` tests unchanged.

**e2e (WebdriverIO)** test ids removed: `source-select`, `sources-button`, `connect-button`, `switch-button`, `disconnect-button`, plus all of `components/sources` (`driver-*`, `manager-connect`, `open-file`, `planned-notice`, ...; grep the specs). New ids: `source-button`, `source-menu`, `source-entry-<id>`, `source-detected-<driverId>-<deviceId>`, `source-simulator`, `source-open-file`, `source-other`, `source-disconnect`, `source-form`, `source-form-connect`, `source-form-back`, `source-form-error`, `source-forget`, `source-rename`, `source-forgot-toast`, `source-undo`, `plot-hint`. Specs: acquisition (pick Signal simulator then Run, Disconnect from menu), failures (seeded simulator entry with `failConnect: true` picked from Your sources -> backend message shown, `Failed`, state Disconnected; seeded file entry with a nonexistent/invalid path -> error; Planned absent from every menu/list), files (seeded file entry with a real fixture path picked from Your sources connects and shows trace; Open file… native dialog is not automatable and is covered by Vitest), persistence (change centre, restart, source listed under Your sources and restores settings; Forget + Undo), migration (v1 `sources.json` seeded: entries listed, ghost/planned hidden, pick works, file rewritten as v2 retaining the hidden entries), sa430 (updated ids; detected device without Scan; hardware only). "Fail to connect" fault injection via the form is covered by Vitest component tests with the mock only (Other sources never lists the simulator).

**e2e seeding mechanism.** The harness already isolates config per worker: `wdio.conf.ts` `beforeSession` creates a temp dir and sets `XDG_CONFIG_HOME` for tauri-driver, and Tauri's `app_config_dir()` resolves to `$XDG_CONFIG_HOME/io.github.spectrumstudio/` (identifier in `tauri.conf.json`). It cannot yet seed. T5 adds: fixtures in `e2e/fixtures/seed/<spec-basename>/` (e.g. `failures/sources.json`); in `beforeSession(config, caps, specs)` after creating the temp dir, if a seed directory exists for the spec file basename, copy its files into `<configHome>/io.github.spectrumstudio/` (done only when the dir is first created, so restarts via `reloadSession` keep the app's own writes). File fixtures reference a real recording by absolute path, so seeds are templates: the string `{{REPO}}` is replaced with the repo root when copying. Separate spec files are used for v1 (`migration.e2e.ts`) and v2 (`failures`, `files`) since the seed is per spec file.

## 9. Tasks and order
| Task | Scope | Depends | Parallel |
| --- | --- | --- | --- |
| T1 | Core store/migration/discover_all + bindings | - | first (small) |
| T2 | Tauri commands + registration | T1 | with T3 |
| T3 | Frontend ipc, state, helpers, mockApi | T1 (bindings) | with T2 |
| T4 | Source button, menu, form, toolbar swap, removal of old UI, CSS | T3 | after T3 (T2 may still be running; tests use the mock) |
| T5 | e2e + docs (user guide, sources.md, roadmap, architecture) | T2, T4 | last |
File ownership is disjoint: T1 Rust core; T2 `src-tauri`; T3 `src/ipc`, `src/state`, `src/test`; T4 `src/components`, `src/App.tsx`, `src/styles`; T5 `e2e`, `docs`.

## 10. Decisions (product manager, 2026-10-31)
1. "Other sources…" deviation REJECTED; design followed exactly (section 3). Failures and typed-path files are e2e-tested through seeded `sources.json` entries (section 8).
2. ACCEPTED: Run after Forget + Disconnect re-remembers the source.
3. ACCEPTED: SA430 replug on another port shows "Not detected" + a second row; T5 records "stable device id" as a known limitation and follow-up in `docs/roadmap.md`.
