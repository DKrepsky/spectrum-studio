# 015 T3: source menu - simulator always offered, "Disconnected" line, refresh on open

Developer report. Scope: `src/state/sourceEntries.ts`, `src/components/source/SourceMenu.tsx` and their tests.
No backend change, no CSS change (the two-line fixed row reuses the existing `.source-row` rules).

## What changed

- `src/state/sourceEntries.ts`
  - `isUnnamedSimulator(entry)` (private): simulator driver and empty (trimmed) `name`.
  - `simulatorEntry(list)` (exported): the most recently used unnamed simulator entry, or undefined.
    T2 can import it from here (merged with this change).
  - `menuModel`: unnamed simulator entries are not in `yours`; named presets stay listed.
    `simulatorInFixedBlock` is now `available.has(SIMULATOR_ID)` (always true while the driver exists).
    The field name is kept, so callers are unchanged. Its doc comment is updated.
- `src/components/source/SourceMenu.tsx`
  - Mount effect: `useSources.getState().refresh()` once each time the menu opens, before the scan effect.
  - Fixed simulator row: `current` when the active source is the simulator driver and no listed row is
    current. Its status is `activeStatus(...)` when current, else `idle`. Picking connects the remembered
    unnamed entry (`connectTo({type:'remembered', id})`) or, when there is none, `SIMULATOR_CONFIG` as before.
    Failed for the fixed row: the failed marker is the config key `simulator` or the entry's row key.
  - `FixedRow`: new `current` prop. When current (and a status is given) it renders the two-line
    `RowBody` inside a `ListRow` with `aria-current`; otherwise the one-line layout as before.
  - `stateWord(status, {isNew, current})` (new helper, used by `RowBody` and `SourceRow`): the status text,
    else "New" for an unremembered device, else "Disconnected" for the current idle row, else nothing.
    The accessible name of the row ends with the same word (`Alpha, Disconnected`).

## Tests

Updated (expectations changed by the rule, not weakened):
- `sourceEntries.test.ts`: `menuModel` simulator-row test now "always offered"; two tests used unnamed
  simulator entries as ordinary rows (the `savedSource()` default is the simulator) and now use named ones.
- `SourceMenu.test.tsx`: "hides the fixed simulator row once the simulator is remembered" replaced;
  keyboard test expects the fixed simulator row between the last row and "Add source…" (ArrowUp from Add
  goes to it); "is a dialog with list content" expects the active row's name "Alpha, Disconnected".

Added:
- `sourceEntries.test.ts`: `simulatorEntry` (most recent unnamed; ignores named presets, other drivers, empty list);
  menu: always offered in the fixed block; unnamed simulator not under Your sources; named preset kept.
- `SourceMenu.test.tsx`:
  - unnamed remembered simulator hidden under Your sources, fixed row connects it by id (not `connectSource`);
  - named preset still listed next to the fixed row;
  - menu open refreshes the list (`listSources` called);
  - a refresh while open does not move focus;
  - fixed row current and "Disconnected" when selected but not connected (`aria-current`, accessible name,
    line 2, idle dot);
  - fixed row shows Connected, then Acquiring from the backend state;
  - fixed row not current, no word, when another source is selected;
  - a selected unnamed remembered simulator is current in the fixed row;
  - failed pick of the simulator reads Failed on the fixed row; picking it again connects the config;
  - a selected named row reads "Disconnected"; an unselected idle row has no word.

## Check results

- `npx vitest run src/components/source src/state`: 11 files, 189 tests passed.
- `npx vitest run` (whole suite, at the time of the run): 56 files, 746 tests passed.
- `npx eslint` on the four changed files: clean.
- `npx prettier --check` on the four changed files: clean.
- `npx tsc --noEmit`: no errors in the changed files. The run reported errors in other files from the
  concurrent 014 T1 (`ParamPlacement`) and 015 T1 (`SessionStatus.launching`) half-done edits
  (`ParamForm.test.tsx`, `SourceMenu.test.tsx`/`sourceEntries.test.ts` fixtures for `placement`, `src/test/fixtures.ts`).
  Those are not mine; they are the same errors that the other developers' tasks own.
- `npm run check` not run as a whole: it would include the other developers' half-done files. Not run e2e (per instructions).
- Not verified visually: the two-line simulator row at 1024 px. jsdom has no layout. QA should look at the
  popover (the simulator row when current) at 1024 and 1440.

## Deviations and notes

- The task said "give the fixed simulator row the two-line layout only when it is current": done, through
  `FixedRow`'s `current` prop.
- Not done (not in T3 files): the plan's "refresh re-adopts the active entry by identity" in `sources.ts`.
  That belongs with T2 (`sources.ts` is in T2's list). The refresh on open is in place.
- `src/state/sourceEntries.ts` and `SourceMenu.tsx` are the only source files changed by T3; no bindings, no CSS.
- Candidate for QA: a remembered unnamed simulator entry whose `label` differs from the driver name shows the
  driver name on the fixed row (the fixed row label is the driver name, as before).
