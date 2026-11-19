# 015 T2 developer report: start-up states, a selection that is never empty, source button

Spec: `tasks/T2.md`; plan `plan.md`; design `design.md` sections 4-5; ADR 0017; DESIGN.md 5.2.
Built on T1 (`SessionStatus.launching`, bindings) and T3 (`simulatorEntry` in `sourceEntries.ts`).
Not committed. No e2e run (015 T5).

## What changed

- `src/state/session.ts`
  - `Startup = 'loading' | 'ready' | 'unavailable'`, pure `startupOf(status, failed)` and
    `selectStartup(state)`: `loading` while the status is null (and not failed) or while
    `launching && state === 'disconnected'`; `unavailable` when status is null and the start-up commands failed;
    `ready` otherwise.
  - `init` failure: `commandError = "Could not reach the backend: <reason>"`, `commandErrorFrom: null`,
    `startupFailed: true`.
  - `receiveStatus`:
    - adopts `status.lastConfig` as the selection while `connecting`, or `disconnected` with a `connectFailed`
      notice, when `busy !== 'connecting'` and the identity differs from `active`. Resolved with `sameIdentity`
      against the list, else `{ id: null, title: fallbackTitle(config, drivers), config }`.
    - a `connectFailed` on `disconnected` calls `setFailed(rowKey(entry) | configKey(config))`.
    - a live source whose identity is not in the list triggers one `sources.refresh()` per status.
    - the existing clearing on connecting/connected/acquiring and the connected-source adoption are unchanged.
    - disconnect never touches `active`.
- `src/state/sources.ts`
  - `forget` of the active entry while `disconnected` selects the simulator: the remembered unnamed simulator
    entry (`simulatorEntry`) or `{ id: null, title: <simulator driver name>, config: SIMULATOR_CONFIG }`.
    Forgetting the connected source still keeps its name.
  - `refresh()` re-adopts an unremembered selection (`active.id == null`) by identity once a list entry matches
    (the backend remembers an auto-connect just after publishing Connected).
  - `init` still never connects.
  - The `active` doc comment says `null` is no longer "Choose a source" after start-up.
- `src/components/source/SourceButton.tsx`
  - `startup !== 'ready'`: a focusable `button` with `aria-disabled="true"`, text "Loading…" or
    "Status unavailable", secondary text colour, no dot, no attention outline, accessible name
    `Source: Loading…` / `Source: Status unavailable`. No `onClick`, so it never opens the menu (ArrowDown does nothing).
  - `ready`: as before. The "Choose a source" label stays only for `ready && active === null`, commented as the
    no-simulator-driver fallback.
- `src/components/source/source.css`: `.source-button.pending` (secondary text colour, default cursor, no hover change),
  tokens only. `source.css.test.ts` green.
- `src/App.tsx`: Ctrl+K returns early unless `selectStartup(...) === 'ready'` (outside the T2 file list, needed by the
  spec: "Ctrl+K while not ready does nothing").
- `status.tsx`, `fixtures.ts`, `mockApi.ts`: unchanged. The `status()` fixture already takes `launching` (T1).
  The start-up failure is mocked in the test (`apiMock.getStatus.mockRejectedValueOnce`).

## Tests added or changed

- `src/state/session.test.ts` (new describe "session store start-up and the selection (015, ADR 0017)", 8 tests):
  - `startupOf` cases, and the store walking loading → ready across a launching status;
  - init failure → unavailable with the banner text;
  - launch connecting adopts the remembered source from `lastConfig`;
  - a failed remembered device stays selected and is Failed (`source-entry-sa`), no simulator;
  - a failed unremembered config is selected by its fallback title and marked by config key (`sa430/SN9`);
  - a failed connect while the UI is connecting does not move the selection;
  - disconnect keeps the selection;
  - an unknown live source reloads the list once, and not again once it is in the list.
- `src/state/sources.test.ts`:
  - changed: "forgetting a selected source that is not connected" now selects the simulator (not null);
  - added: forget selects the remembered unnamed simulator entry;
  - added: refresh re-adopts an unremembered selection by identity, and leaves it alone with no match.
- `src/components/source/SourceButton.test.tsx` (new describe "start-up (ADR 0017)", 5 tests): Loading… before the first
  status (name, no dot, no attention, aria-disabled, not clickable, ArrowDown does nothing); Loading… while launching
  without a connect, then the name with Disconnected/idle dot; the connecting source name while a launch connects it;
  Status unavailable with its accessible name. The "Choose a source" test is kept, commented as the fallback.
- `src/App.test.tsx`: waits until the source button no longer reads Loading… before pressing Ctrl+K (the Ctrl+K guard
  made the old race visible). Its plot-hint assertion still expects the old "Choose a source" copy: that copy belongs to
  T4 and is unchanged here.

## Check results

- `npm run check`: exit 0. `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`,
  `cargo test --workspace` (all pass), bindings regenerated (no diff from T1's), Prettier check, ESLint (`--max-warnings 0`),
  `tsc --noEmit` (app and e2e), Vitest: 58 files, 790 tests passed.
- Before the final gate: targeted Vitest on `src/state`, `src/components/source`, `App.test.tsx` 13 files, 213 tests pass;
  full Vitest 58 files, 790 tests pass.
- Log: `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/4c0a989e-67c9-4b64-9595-d4ba9bcd2b0d/scratchpad/check-015-t2.log`.
- e2e: not run (per instructions; 015 T5). Real app: not run, so the visual result at 1024 / 1180 / 1440 is not verified.

## Deviations from the task, and why

- The store has `startupFailed: boolean`, and `startup` is derived (`selectStartup(state)`), not a stored field. The
  reason: a stored field is only set by `receiveStatus`/`init`, so any test or code that sets `status` directly (the
  MeasurementPanel tests do) would read "Loading…" forever. One rule, derived from the status, avoids that. `startupOf`
  is exported as the spec asked.
- The unknown-source refresh is not deduplicated across statuses. Each status whose source is not in the list calls
  `refresh()` once. After that refresh the list holds the entry, so there is no loop; it costs one IPC call per such status.
- `App.tsx` Ctrl+K guard (not in the file list; required by the spec).
- `refresh()` returns early on error (before the identity step), so a failed list read keeps the selection as it was.

## Open for others / not done

- `SpectrumView.tsx` still says "Choose a source to begin. Try Signal simulator." and `SourcePanel.tsx` says
  "Choose a source to see its settings.": T4 copy. `App.test.tsx` and `SpectrumView.test.ts` assert the old copy and
  must change with T4.
- Measurement's capture reason "Loading…" and the Source settings copy are T4 as well.
- Not verified in the real app: the launch-with-failed-device banner (existing `NoticeBanner` shows Reconnect for
  `connectFailed` on a disconnected status with `lastConfig`, read in the code, not run), and the start-up layout.
- The Storybook `SourceButton` story (if any) was not checked for the pending state.
