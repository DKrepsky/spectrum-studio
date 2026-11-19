# 014 T3 developer report: Measurement rows from capabilities; Source settings keeps its own rows (#45)

Spec: `tasks/T3.md`; plan `plan.md`; design `design.md` sections 2, 4, 5, 6, 8; DESIGN.md 3.6.
Not committed. Depends on T1 (`ParamSpec.placement`) and T2 (`NumberField` null value, unit description).

## What changed

Frontend only; no Rust, no bindings change in this task.

- `src/components/ParamForm.tsx`
  - `ParamField` is exported with `ParamFieldProps`; new props `noValue` (number: `value={null}`, em dash, not
    stepped; choice: one `—` option) and `reason` (tooltip on the control and part of the accessible description).
  - The driver `help` is a real description: visually hidden text with id `<id>-help`, merged into
    `aria-describedby` (after the caller's ids, before the reason). The field wrapper keeps the help as `title`.
  - Hz number fields accept `null` too (`FrequencyField` already does).
- `src/components/panels/SourcePanel.tsx`: lists only `placement === 'source'` params; the existing hint
  "This source has no additional settings." when none. Copy otherwise unchanged.
- `src/components/panels/MeasurementPanel.tsx` (rewritten row rule, per task rule 1-8):
  - Rows: source button, Center, Span, each measurement param via `ParamField` (`id="measurement-<id>"`,
    inline, flat), FFT size and Window only when `caps.dataKind === 'iq'`, Averaging and the hold row when
    `processing` is known, then `CaptureControl`. Rows that do not apply are not rendered.
  - No source open: device rows get `noValue` + `disabled` + reason (`Connect a source first` / `Connecting…` /
    `Disconnecting…`); FFT/Window keep processing values with the same reason. Averaging and holds stay enabled.
  - Center and Span are now also `disabled` while no source is open (the cache would otherwise enable them
    when a source was opened earlier this run; the em dash stays).
  - Removed the trace branch (`TRACE_REASON`) entirely.
  - Rows are wrapped in `<div class="measurement-rows">` (flex column, `--space-4` gap, same spacing as the
    section body). Its `onFocus` records the focused row id; a layout effect moves focus to Averaging, else the
    source button, when that row has left the DOM and focus has fallen to `body`.
  - Measurement param `onChange` calls `applySettings({ centerHz: null, spanHz: null, params: { [id]: v } })`.
    `readOnly` while `busy === 'applying'`.
- `src/styles/app.css`: `.measurement-rows` rule next to `.panel-row`. (Not a new CSS file: `cssImport.test.ts`
  keeps a list of feature stylesheets, and I did not want to extend that list for one rule.)
- `src/state/session.ts`: `capabilitiesByDriver: Record<string, Capabilities>` in the store (initial `{}`),
  set in `receiveStatus` for every status with a source, never cleared by a disconnect.
- `src/state/selectedCapabilities.ts` (new): pure selector `selectedCapabilities(session, sources)`:
  open source's capabilities, else the cache entry of `sources.active.config.driverId`, else `undefined`.
- `src/components/ParamForm.test.tsx`, `src/components/SidePanel.test.tsx` (wrapper), `MeasurementPanel.test.tsx`,
  `session.test.ts`: updated or added (below). `src/components/panels/SourcePanel.test.tsx`: new.
- Docs: `docs/user-guide.md` (Measurement table gets the source rows, FFT/Window and Averaging rows; "Measurement
  panel" text on which rows show; new short "Source settings" section). `DESIGN.md` status words only:
  M14, M15, M16 "Approved and implemented (014)" (M16 was "Proposed"). No prose changed.

## Tests added or changed

- `ParamForm.test.tsx` (+5): help is the accessible description (with unit appended) and the wrapper title; no
  help text when the spec has none; `noValue` number shows `—` placeholder, disabled, unit description `kHz`;
  `noValue` choice shows one `—` option; reason is tooltip and description.
- `SourcePanel.test.tsx` (new, 4): only source params listed; hint when only measurement params; hint for no
  params; a source param applies from its own field.
- `MeasurementPanel.test.tsx`: existing tests updated to the rule (wrapper element; FFT rows absent for a source
  never opened in this run; disabled with reason after a connected simulator closes; `Connecting…`; trace source
  has no FFT/Window). BeforeEach now resets `capabilitiesByDriver`. New describe "rows follow the selected
  source" (+11): trace row set; IQ row set; DOM order (rows, hold, capture); `—` disabled rows after close with
  reason and unit in description; `Connecting…` on device rows; never-opened source shows Center, Span, Averaging
  only; Frequency step commit (`{stepKhz: 50}`, focus stays); out-of-range not sent; Reference level pick
  (`{refLevelDbm: '-40'}`); read-only not disabled while applying; focus moves to Averaging when the focused
  Frequency step row leaves (uses `act`).
- `session.test.ts` (+3): the cache records per driver, keeps entries across disconnect and adds other drivers,
  records nothing without a source.
- `selectedCapabilities.test.ts` (new, 4): open source wins; cached entry while disconnected; undefined for a
  driver not opened this run; undefined with no selected source.

## E2E changes (not run, per instructions)

- `e2e/specs/acquisition.e2e.ts`
  - "disables FFT size and Window with their reason while no source is connected" renamed to "keeps FFT size and
    Window disabled with their reason once the simulator has been opened, as Center and Span are". It now calls
    `runSimulator()` then `ensureDisconnected()` before the same checks, because at launch nothing has been opened
    in the run and the rows are now absent (the trace-kind half of the task's wording is covered by the unit test;
    the e2e build has no trace source).
  - "puts the source button first ..." now asserts the connected simulator's Measurement labels equal exactly
    `['Center', 'Span', 'FFT size', 'Window', 'Averaging']` (no Frequency step or Reference level), was `slice(0, 3)`.
- `e2e/specs/sa430.e2e.ts` (env-gated, only edited, not run): new test "shows Frequency step and Reference level in
  Measurement, not in Source settings, and applies Frequency step": selects the remembered SA430, checks the
  Measurement labels `Center, Span, Frequency step, Reference level, Averaging`, the Source settings hint, then
  types 50 into `#measurement-stepKhz` (applies) and back to 100.
- `visual.e2e.ts`, `failures.e2e.ts`, others: checked, no expectation on the removed rows; not changed.

## Check results

- `npm run check`: exit 0. Rust: fmt, clippy, workspace tests all pass (includes the 015 autoconnect test as it
  stands now). Vitest: 58 files, 774 tests passed. ESLint, Prettier, `tsc --noEmit` (app and e2e) clean.
- `npx tsc --noEmit -p e2e`: clean. `npx eslint` on the e2e specs: ignored by config (no errors).
- `npm run e2e`: NOT run (per instructions; 015 T5 runs the suite).

## Deviations from the task, and why

- Wrapper element `.measurement-rows` (task says "onFocus on the container"): needed for the container. Its CSS
  is in `app.css` (see above). The SidePanel and MeasurementPanel tests and the e2e layout check were updated
  to look inside the wrapper; the e2e check `body.firstElementChild` still finds the source button.
- Center and Span also disabled with no source (task did not say, but the cache made them enabled otherwise,
  which contradicts rule 4 and DESIGN.md 3.6).
- `reason` prop added to `ParamField` (not in the task list): the disabled reason needs a place in the field; the
  task's rule 4 requires it in the tooltip and description.
- Selector put in its own file `src/state/selectedCapabilities.ts` (not in `session.ts`) to keep `session.ts`
  small for 015 T2; its tests are in `selectedCapabilities.test.ts`; cache tests are in `session.test.ts`.
- The e2e "FFT disabled" test does not cover the trace-kind half (no trace source in the e2e app).

## Not done / open for others

- Visual check of the label column at 1024 / 1180 / 1440 (design section 2, QA measures): not done here.
- Focus rule: the moved focus goes to Averaging even when the row that left was not the last one in DOM order
  (as the task specifies); design section 6 suggests "next control in DOM order", which is Averaging for both kinds
  in this layout anyway.
- The hold row is shown for both kinds (Q-29 assumption kept).
- Existing dev-T2 note stands: unit linkage for every NumberField.
- The Display panel's Reference level is unchanged (plot level, Display section).
