# Review T2 + T3 (006-capture-modes)

Verdicts: **T2 approved. T3 approved.**

Verified: `cargo test --workspace` all green, `npm test` green. Read the diffs against tasks/T2.md, T3.md, plan.md, ADR 0013.

## T2
- `Preferences.capture_mode` uses `serde(default, deserialize_with = "lenient_capture_mode")`. An unknown or non-string value falls back to Continuous and only that field is lost. The `CaptureMode` enum stays strict, so IPC rejects bad values via typed deserialisation.
- The Preferences-level fallback is tested (T1 condition met): `unknown_stored_capture_mode_loads_as_continuous_and_keeps_the_rest` (display and lastSourceId kept, no warnings, "burst" rejected by the enum), `a_non_string_stored_capture_mode_also_loads_as_continuous`. Default and round-trip tests are present. Silent fallback accepted by the PM.
- `set_capture_mode`: session first, then persist. A persist failure gives the same message as `set_processing`. It is registered, and the manager is built with `.with_capture_mode(prefs)`. Refusal while acquiring comes from the core (T1 tests).
- SA430 session tests cover single success (one frame, Connected, no more frames, restart gives a newer frame) and failure (AcquisitionFailed, stays Connected). Reported as run 15 times with no flakes.
- Binding `Preferences.ts` regenerated. ADR amended to describe the lenient deserialiser.
- Non-blocking: no unit test for the Tauri command body (the crate has no command tests; the logic is covered in core). If persist fails after the session change, the UI shows an error while the mode did change. The status event still arrives, so the UI converges. Acceptable.

## T3
- `api.setCaptureMode` calls `set_capture_mode { mode }`; the mock is added.
- The store action uses busy op `settingMode`, errors go through the command error path, and there is no optimistic update (the mode changes only from status).
- `liveness(..., mode)`: single and acquiring gives `capturing` (label CAPTURING), never live or stale. Continuous and non-acquiring results are unchanged. Undefined mode behaves as continuous. `useLiveness` and `SpectrumView` pass the mode through.
- The tests cover the matrix and the store success and failure paths.
- Note for T4: `.liveness-capturing` has no CSS yet, and `LivenessKind` gained `capturing`, so check any exhaustive switches or badges that consume it.

No changes required.
