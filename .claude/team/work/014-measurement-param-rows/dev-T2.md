# 014 T2 (developer): NumberField with no value and an announced unit

## What changed
- `src/ui/Field/NumberField.tsx`
  - `value: number | null`. `null`: empty input, `placeholder="—"` (a caller `placeholder` is replaced while
    there is no value), ArrowUp/ArrowDown do nothing, Enter/blur with no draft commit nothing, no range
    message and no invalid mark. A typed draft is still validated and committed.
  - Unit suffix span gets an id (`useId`); `aria-describedby` = caller's value first, then the unit id
    (appended, not overwritten). Applies to every NumberField with a unit (Averaging, Range, Source settings).
  - `inRange` is a type guard (`n is number`), so commit and step narrow without assertions.
- `src/ui/Field/Field.css`: `.ui-field__input::placeholder` uses `--color-text-secondary` (token only).
- `src/ui/Field/NumberField.test.tsx`: 8 new tests (null placeholder and value; no stepping; no commit on
  Enter/blur; typed value commits and out-of-range is invalid with null; unit as accessible description
  `kHz`; caller description kept with unit appended; no description without unit).
- `src/ui/Field/Field.stories.tsx`: `NumberFieldNoValue` (no value, disabled, unit) and
  `NumberFieldUnitWithHint` (unit plus a caller hint, both in the description).
- `DESIGN.md` 4.4: "States" line gains the null-value description; the unit line is now
  "Approved and implemented". Nothing else in DESIGN.md touched (the file has other agents' edits too).

No Rust, no bindings, no `src/components` or `src/state` changes.

## Tests and checks
- `npx vitest run src/ui/Field/` : 3 files, 67 tests passed.
- `npx vitest run src/ui` : 25 files, 376 tests passed (includes `stories.test.tsx` axe run over the new
  stories, `cssImport.test.ts`, `boundary.test.ts`).
- `npx vitest run src/components/panels src/components/ParamForm` : 2 files, 36 passed (NumberField callers).
- `npx prettier --check src/ui/Field DESIGN.md` : clean.
- `npx eslint src/ui/Field` : clean.
- `npx tsc --noEmit` : no errors in `src/ui`. Remaining errors are outside my scope, from the 014 T1
  `ParamSpec.placement` bindings change and the 015 `SessionStatus.launching` fixture
  (`src/components/ParamForm.test.tsx`, `src/components/source/SourceMenu.test.tsx`,
  `src/state/sourceEntries.test.ts`, `src/test/fixtures.ts`). Not touched by me.
- Not run: full `npm run check` (blocked by the concurrent edits above), e2e (not asked), a visual
  screenshot of the new placeholder (not done; the placeholder colour is a token and is for T3 to check
  in the Measurement rows at 1024/1180/1440).

## Notes for T3
- The Frequency step accessible description is "kHz" once T3 passes `unit="kHz"`.
- Enabled `FrequencyField`/`NumberField` with no value: pass `value={null}` and `disabled`; the field
  then shows `—` (NumberField) and the placeholder, and never steps.
