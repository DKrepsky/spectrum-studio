# 015 plan: always a source selected; simulator fallback (#46, also closes #3)

Inputs: `story.md` (with the design gate), `design.md` (R1-R14, S0-S13), DESIGN.md 5.2, 5.8, 8.2, 12.
Human decisions applied: Q-27 a device that fails at launch stays selected in Failed, no fallback; Q-28
overridden: any idle simulator is replaced by a plugged-in device, never an acquisition; Q-30 B3
("Loading…", "Status unavailable") in scope; Q-31, R10, R11 accepted. ADR:
[0017](../../../../docs/adr/0017-simulator-fallback-and-idle-replacement.md) (amends 0014). DESIGN.md R6/M22/Q-28
wording was updated to match (done in this planning pass).

## Approach

**Backend (`spectrum-core`, device-agnostic).**
1. `Policy::launch`: first discovered device, else the fallback simulator picked by
   `DriverInfo.kind == Simulator` (never by id), connected through `remember::auto_connect` (stored
   settings, remembered, becomes `lastSourceId`). A found device that fails: no fallback.
2. `connect_if_idle` (the single guard, under the worker lock) also treats a `Connected` (not
   `Acquiring`) source with `ActiveSource.simulated` as replaceable. One pure function
   `may_replace(&SessionStatus) -> bool` in `session/` is used by the guard and by `Policy::on_event`
   (replacing `has_active_source`). Acquiring: never. Real device connected: never.
3. `SessionStatus.launching: bool`: set by `AutoConnect::start` before the coordinator runs, cleared by
   the coordinator after the launch rule (also on panic, also if the thread cannot spawn). Default
   `false` so tests and embedders are unaffected.
4. `Removed` of the active device: unchanged (`DeviceLost`, no fallback, R9).

**Frontend.**
5. Start-up (`session.ts`): `startup: 'loading' | 'ready' | 'unavailable'`. `loading` until the first
   status arrives, and while `status.launching && state === 'disconnected'` (no connect begun yet).
   `unavailable` when `init` fails (banner "Could not reach the backend: <reason>").
6. Selection never null once `ready`: `active` follows the connected source (as today) and, new, the
   connecting / failed source via `status.lastConfig` (resolved against the remembered list, else a
   fallback title). A `connectFailed` notice on a `disconnected` status marks that source Failed
   (`useSources.failed`), so a launch failure shows Failed with no UI action. Disconnect keeps `active`.
   Forgetting the selected, not connected source selects the simulator (not connected) (R10).
7. Menu (R11): the Signal simulator is always in the fixed block; unnamed simulator-driver entries are
   not listed under Your sources (named legacy presets stay listed). The current row's line 2 reads
   "Disconnected" when selected but not connected. The menu refreshes the remembered list on open and
   `refresh` re-adopts the active entry by identity (the backend remembers an auto-connect after it
   publishes Connected, so the list can be one step behind).
8. Copy: "Loading…", "Status unavailable", plot hint "Not connected. Use the source button to
   connect.", Source settings "Connect a source to see its settings.", capture reason "Loading…";
   "Choose a source" copies retired (a defensive fallback label stays in `SourceButton` for the
   unreachable "no simulator driver registered" case, commented as such).

## Data / IPC

- `SessionStatus` gains `launching: bool` (camelCase `launching`). `npm run bindings`; commit
  `src/bindings/SessionStatus.ts`; update `src/test/fixtures.ts` and `mockApi` status builders.
- No new command. The shell (`src-tauri/src/lib.rs`) is unchanged: `AutoConnect::start` already runs in
  `setup`. Check `src-tauri` for any `SessionStatus` literal (none expected).

## Error handling and validation

- Every connect goes through existing validated paths (`resolve_params`, drivers' own errors). A failed
  launch connect gives the same `ConnectFailed` notice as a manual one; nothing retries.
- The policy never starts acquisition (asserted by tests).
- A panic in the launch step is contained (`contain`), and `launching` is still cleared.
- Stored settings that the simulator rejects fall back to defaults (existing `retry_with_defaults`).

## Risks

- **Device replace failure** leaves the session `Disconnected` (simulator closed, device failed). Accepted
  by the same principle as Q-27; QA checks the banner and that the device is the selection.
- **Race: remember after Connected.** The UI may see the connected simulator before its entry exists
  (title from `deviceLabel`, `id: null`). Mitigated by menu-open refresh and identity re-adoption; QA
  checks the title and the current row after a launch.
- **A failed unremembered device at launch** shows the fallback title ("<driver name> · <serial>") not
  its label ("SA430 <serial>"): the label only exists after a successful open. Acceptable and honest;
  mention to QA.
- **Existing tests encode the old policy** (`launch_with_no_device_or_only_the_simulator_does_nothing`,
  `added_while_the_simulator_is_connected_changes_nothing`, SA430 crate `tests/autoconnect.rs`,
  e2e specs that start "disconnected", the persistence spec that expects the fixed simulator row to
  vanish). They must be rewritten to the new rules, not weakened.
- **e2e launch state changes** for every spec: the app starts with the simulator connected. T5 budgets
  this (helpers, specs, seeds). Specs that need "nothing connected" call `ensureDisconnected()`.
- **Overlap with 014**: frontend tasks T2-T4 touch `session.ts`, `MeasurementPanel.tsx`,
  `SourcePanel.tsx`, `acquisition.e2e.ts`, which 014 T3 also touches. Merge 014 T3 first.
- Candidate follow-ups for the PM (not in scope): persist the last known kind per driver across
  launches; a setting to turn the launch fallback off.

## Test plan

- Rust (`crates/spectrum-core/tests/autoconnect.rs` with the scripted fake hardware plus the real
  simulator driver; `session.rs` for the guard):
  launch no device -> simulator `Connected`, not acquiring, remembered, `lastSourceId` set, `launching`
  false afterwards and true before; launch with a device -> device, simulator not connected; device
  found but fails -> `Disconnected` + `ConnectFailed` + nothing remembered + no simulator; scan errors
  only -> simulator; `Added` while the simulator is idle (both when launch-connected and when picked
  manually) -> device replaces it; `Added` while the simulator is acquiring -> untouched and still
  acquiring; `Added` while a real device is connected/acquiring -> untouched; `Removed` of the device ->
  `DeviceLost`, no simulator; `connect_if_idle` race: a manual connect that wins is never replaced;
  never starts acquisition in any path; launch with a panicking driver still clears `launching`.
  SA430 crate (`tests/autoconnect.rs`, `session.rs`): update expectations for the fallback.
- Vitest: session `startup` states; `receiveStatus` adopts the connecting/failed source from
  `lastConfig`; failed marker from a `connectFailed` notice; disconnect keeps `active`; forget selects
  the simulator; `SourceButton` "Loading…", "Status unavailable", name + idle dot while disconnected,
  accessible names; `menuModel` simulator row always, unnamed simulator entries hidden, named kept;
  `SourceMenu` current row "Disconnected"; plot hint, capture reason, Source settings copy.
- e2e: no device -> simulator selected and connected, not acquiring, hint "No trace yet…"; disconnect keeps
  the name with the idle dot and the "Not connected" hint; failures spec (failing simulator) still
  Failed; persistence spec; real-device specs (env-gated) for launch with a device and for plug-in
  replacing an idle simulator. A physical test by the human follows QA (PM plan).

## Tasks

| Task | What | Depends on | Parallel |
| --- | --- | --- | --- |
| T1 | Core: `launching`, `may_replace`, policy (launch fallback, idle-simulator replacement), tests, bindings, docs | none | with T3 |
| T2 | Frontend state: startup states, selection from `lastConfig`, Failed from notice, disconnect/forget, `SourceButton`, `status.tsx` | T1 (bindings), T3 (`simulatorEntry` helper) | after T1 and T3 |
| T3 | Menu: simulator always offered, unnamed simulator entries hidden, "Disconnected" line, refresh on open | none | with T1 |
| T4 | Copy surfaces: plot hint, capture reason, Source settings, Measurement loading | T2 | after T2 |
| T5 | e2e budget and docs: helpers, specs, seeds, user guide, testing.md | T1-T4 (and 014 T3) | last |

File overlap: T1 (core, docs/sources, architecture), T2 (`session.ts`, `sources.ts`, `status.tsx`,
`SourceButton.tsx`, fixtures/mocks), T3 (`sourceEntries.ts`, `SourceMenu.tsx`) are disjoint, so T1 and T3
can run in parallel worktrees; T2 starts once both are merged (bindings from T1, `simulatorEntry` from T3). T4
touches `SpectrumView.tsx`, `CaptureControl.tsx`, `SourcePanel.tsx`, `MeasurementPanel.tsx`,
`StatusBar.tsx` (copy only): after T2 and after 014 T3. T5 touches `e2e/**` and docs only.
