# 014 plan: Frequency step and Reference level in Measurement; hide unused rows (#45)

Inputs: `story.md`, `design.md`, DESIGN.md 1.0-draft.5 (3.6, 4.4, 4.5, 12.1 M14-M16, 12.2 Q-24..Q-29).
Decisions applied: label "Frequency step"; both "Reference level" labels kept (driver text unchanged);
Source settings keeps its "This source has no additional settings." hint (Q-26); hold row for both
kinds (Q-29). ADR: [0018](../../../../docs/adr/0018-measurement-rows-from-param-placement.md).

## Approach

1. **Placement on the spec (generic, device-agnostic).** `ParamSpec` gets `placement: ParamPlacement`
   (`measurement` | `source`, default `source`). The SA430 marks `stepKhz` and `refLevelDbm` as
   `measurement`. The UI never reads `driverId`.
2. **Row rule (UI, from `Capabilities`).** Order in Measurement: source button, Center, Span, the
   `measurement` params in driver order, FFT size and Window (only `dataKind === 'iq'`), Averaging,
   hold row, capture control. Rows that do not apply are not in the DOM. `dataKind` unknown (no
   capabilities for the selected source this run): Center, Span, Averaging, hold row, capture.
3. **Kind while disconnected.** UI-side cache `capabilitiesByDriver` in `useSession`, updated on every
   status with a source; the selected source's driver picks the entry. Device rows show `—` and are
   disabled. (Decision and rejected alternatives in ADR 0018; the designer's "backend" preference is
   not taken because the one case it would add, a source never opened this run, has no answer either.)
4. **One field component.** `ParamField` is exported from `src/components/ParamForm.tsx`; Source
   settings (via `ParamForm`) and the Measurement group both use it. It adds the driver `help` as a
   real accessible description (visually hidden text + `aria-describedby`), keeping the `title`.
5. **`src/ui` change (own task).** `NumberField` gets a `null` value (empty, `—` placeholder, no
   stepping) and links its unit with `aria-describedby`. Storybook + tests + DESIGN.md 4.4 status.
6. **Focus when a kind row disappears** (design 6): Measurement tracks the last focused row; if the
   focused row leaves the DOM, focus goes to Averaging, else the source button.

## Data / IPC

- `ParamSpec` (Rust) changes: new field `placement`. `npm run bindings`; commit `src/bindings/ParamSpec.ts`
  and the new `ParamPlacement.ts`. No new command, no event change, no persisted-JSON change
  (`Capabilities` is never stored; `#[serde(default)]` keeps old payloads valid, tests rely on it).
- Validation unchanged: `check_partial` / `resolve_params` in Rust already validate `apply_settings`
  params; Measurement uses the same `applySettings({ params: {id: v} })` path.

## Files by module

| Module | Files |
| --- | --- |
| core | `crates/spectrum-core/src/model/params.rs`, `model/mod.rs` (export), literals in `tests/probe.rs`, `tests/session.rs`, `tests/autoconnect.rs`, `tests/remember.rs`, `src/store.rs` tests |
| driver | `crates/spectrum-driver-sa430/src/lib.rs` (`runtime_params`, `connection_params` literal) |
| bindings | `src/bindings/*` generated |
| ui | `src/ui/Field/NumberField.tsx` (+ test, stories), DESIGN.md 4.4 |
| feature | `src/components/ParamForm.tsx`, `panels/MeasurementPanel.tsx`, `panels/SourcePanel.tsx`, `src/state/session.ts` (cache), tests |
| e2e | `e2e/specs/acquisition.e2e.ts` (FFT/Window test), `e2e/specs/sa430.e2e.ts` (real device, env-gated), `e2e/specs/visual.e2e.ts` only if a guard asserts the old rows |
| docs | `docs/sources.md`, `docs/user-guide.md`, DESIGN.md status words |

## Error handling and validation

- Frequency step range 10-500 kHz and the Reference level options are validated in Rust exactly as
  before; the UI never sends an out-of-range number (NumberField), and a rejected apply shows the
  command banner and the field returns to the device value (existing `applySettings` behaviour).
- The cache is display-only; a stale cache entry cannot send anything because the rows are disabled
  without a source.

## Risks

- **Label column width** for "Frequency step" and "Reference level" at 1024/1180/1440 (QA measures; if
  it clips, the fix is CSS in the panel, not a label change; report to PM).
- **Focus handling** when the kind changes is easy to get wrong; it has a unit test and an e2e check
  where a device can replace the simulator (only with hardware; simulated in a unit test).
- **Overlap with 015**: `session.ts`, `MeasurementPanel.tsx`, `SourcePanel.tsx` are also touched by
  015's frontend tasks. Run 014 T3 first, then 015 T2-T4 (or let one developer do both).
- The first Measurement row set of a launch with a failed device is the reduced set (design section 4,
  third row). Remembering the kind across launches is a possible follow-up (candidate for the PM:
  static runtime specs on `DriverInfo`).

## Test plan

- Rust (`spectrum-core`): `ParamSpec` JSON round trip with and without `placement`; `in_measurement()`
  builder; resolve/check unaffected. SA430 crate: runtime params are exactly `[stepKhz, refLevelDbm]`
  with placement `measurement`, in that order; the SA430 session test keeps applying both through
  `apply_settings`.
- Vitest: `NumberField` null value + unit description; `ParamField` help description; MeasurementPanel
  row sets for trace, IQ, unknown and disconnected-with-cache; absent rows are not in the document;
  DOM order equals visual order; Frequency step commit sends `{params:{stepKhz}}`; Reference level
  change sends `{params:{refLevelDbm}}`; focus moves to Averaging when the focused kind row goes;
  SourcePanel lists only `source` params and shows the hint when none.
- e2e: simulator shows Center, Span, FFT size, Window, Averaging and no Frequency step/Reference level
  rows; the old "FFT size and Window disabled while disconnected" test becomes "rows follow the
  selected source" (see 015 for the launch state). SA430 (env-gated): the rows read as in #45 and
  Frequency step applies.

## Tasks

| Task | What | Depends on | Parallel |
| --- | --- | --- | --- |
| T1 | `ParamPlacement` in core, SA430 marks its params, bindings, docs/sources | none | with T2 |
| T2 | `src/ui` `NumberField`: `null` value and unit description, stories, DESIGN.md 4.4 | none | with T1 |
| T3 | Measurement rows, Source settings filter, `ParamField` export, capability cache, tests, e2e | T1, T2 | after both |

File overlap: T1 and T2 touch disjoint files. T3 overlaps 015 T2 (`session.ts`), 015 T4
(`MeasurementPanel.tsx`, `SourcePanel.tsx`): sequence T3 before those.
