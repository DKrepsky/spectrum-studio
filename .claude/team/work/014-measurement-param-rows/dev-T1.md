# 014 T1 developer report: ParamPlacement on ParamSpec (#45)

Scope: `ParamPlacement` in core, SA430 marks `stepKhz` and `refLevelDbm` as measurement, bindings,
docs. Spec: `tasks/T1.md`; decision: ADR 0018.

## What changed

- `crates/spectrum-core/src/model/params.rs`: `enum ParamPlacement { Source (default), Measurement }`
  (camelCase serde, ts-rs export, `Copy`, `Default`); `ParamSpec.placement` with `#[serde(default)]`;
  constructors set `Source`; builder `in_measurement()`.
- `crates/spectrum-core/src/model/mod.rs`: re-exports `ParamPlacement`. (`model` is already public from
  the crate root, so nothing else needed exporting.)
- `crates/spectrum-driver-sa430/src/lib.rs`: `runtime_params()` marks `stepKhz` and `refLevelDbm` with
  `.in_measurement()` (order, labels, help, ranges unchanged); `connection_params()` literal gets
  `placement: Source`; three new tests (below).
- `ParamSpec` literals gained `placement`: `crates/spectrum-core/src/store.rs` (test),
  `crates/spectrum-core/tests/{autoconnect,remember,probe,session}.rs`.
- `docs/sources.md`: new "Placement" bullet in the ParamSpec section; SA430 settings line notes both
  settings are `measurement`.
- Generated: `src/bindings/ParamPlacement.ts` (new), `src/bindings/ParamSpec.ts` (placement field).
  `npm run bindings` also rewrote `src/bindings/SessionStatus.ts` from 015's in-progress `launching`
  field; that file is NOT part of this change and should not be committed by 014.
- TS test/fixture literals typed `ParamSpec` needed `placement: 'source'` for `tsc` (otherwise
  `npm run check` fails): `src/test/fixtures.ts`, `src/components/ParamForm.test.tsx`,
  `src/components/source/SourceMenu.test.tsx`, `src/state/sourceEntries.test.ts`. The last two are 015
  T3's files; only the field was added (prettier also ran on them and reformatted nothing of 015's
  beyond what was already there). Flag for merge ordering.

## Tests added

- `model::params::tests::placement_defaults_to_source_and_in_measurement_sets_it`
- `model::params::tests::placement_round_trips_and_defaults_when_missing` (serialises
  `"placement":"measurement"`, round trip, and a payload with the key removed deserialises as `Source`)
- `sa430::tests::runtime_params_are_step_and_level_in_measurement` (ids `[stepKhz, refLevelDbm]`, both
  `Measurement`, step kind `Number{10,500,5,unit kHz}`, default 100, help present)
- `sa430::tests::connection_params_stay_in_source_settings`
- `sa430::tests::opened_source_reports_step_and_level_as_capabilities` (through `open` with the
  scripted backend: `Capabilities.params` is `[stepKhz, refLevelDbm]`, both Measurement)

## Check results

- `cargo fmt --all -- --check`: clean.
- `cargo clippy -p spectrum-core -p spectrum-driver-sa430 --all-targets -- -D warnings`: clean.
- `cargo test -p spectrum-core --lib`: 100 passed.
- `cargo test -p spectrum-core --test session`: 25 passed; `--test probe`: 8 passed;
  `--test remember`: 16 passed.
- `cargo test -p spectrum-driver-sa430 --lib`: 36 passed (3 new). `--test session`: 3 passed;
  `--test autoconnect`: 12 passed (1 ignored, hardware).
- `npm run bindings`: ok.
- `npx vitest run` on `ParamForm.test.tsx`, `sourceEntries.test.ts`: pass. `SourceMenu.test.tsx`: 3
  failures in "Your sources" (simulator/unnamed entry behaviour), 015 T3 in-progress work; my change
  there is type-only.
- `npx prettier --check` and `eslint` on the four TS files: clean.
- `npx tsc --noEmit`: only remaining error is `src/test/fixtures.ts` `launching` (015 T1's
  `SessionStatus.launching`, not mine).

## Failures not caused by this task (for 015 / merge)

- `crates/spectrum-core/tests/autoconnect.rs::connect_if_idle_leaves_a_connected_source_alone` fails
  (line 772). Passes at HEAD. Cause: 015 T1 changed `connect_if_idle` so an idle simulator is replaced
  (`may_replace` in `session/mod.rs`), which contradicts this test's expectation. That test file is
  015's. The only line I touched in it is the `placement` literal.
- `npm run check` therefore is NOT green in the shared checkout right now; run it after 015 T1 lands.

## Not done / deviations

- `npm run check` was not run as a whole (the failures above are other tasks'). Targeted runs above.
- No e2e (per instructions). No UI change in this task.
- Nothing committed.

## Notes for T3

- `ParamSpec.placement` is typed `ParamPlacement` in `src/bindings/ParamSpec.ts` and
  `src/bindings/ParamPlacement.ts` (`'source' | 'measurement'`).
