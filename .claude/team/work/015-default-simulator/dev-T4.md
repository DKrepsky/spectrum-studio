# 015 T4 developer report: copy surfaces (plot hint, capture reason, Source settings, Measurement, status bar)

Spec: `tasks/T4.md`; `plan.md` (item 8); `design.md` sections 5, 7; ADR 0017; 014 `dev-T3.md`.
Built on T2 (`selectStartup`, `Startup`) and on the 014 T3 state of `MeasurementPanel.tsx` / `SourcePanel.tsx`.
Not committed. No e2e run (T5).

## What changed

- `src/components/SpectrumView.tsx`
  - `plotHint(startup, state, mode, kind, hasFrame)`: the first argument is the start-up state (was `noSource`).
    `startup !== 'ready'` -> no hint; a frame -> no hint; `state === 'disconnected'` -> "Not connected. Use the source
    button to connect."; the capturing, connected and connecting branches are unchanged.
  - The caller reads `useSession(selectStartup)`; the `useSources` import is gone from this file.
  - The "No source connected" tag is untouched (it comes from `liveness.ts`, by state).
- `src/components/capture/CaptureControl.tsx`
  - `noSourceTitle(state, startup)`: `loading` -> "Loading…" first, then the connecting/disconnecting/"Connect a source first"
    rules as before. Feeds the main button title, the chevron and main descriptions (`mainReason`, `chevronReason`).
  - `mainView` takes `startup` for the same reason.
- `src/components/panels/MeasurementPanel.tsx` (on top of the 014 T3 content present on disk)
  - `unavailableReason(state, hasSource, startup)`: `loading` -> "Loading…" for the device rows and FFT/Window reasons.
    This is the 014 design row "Loading: Unavailable, reason 'Loading…'". Center and Span were already em dash and disabled
    with no source; Averaging and the hold row were already not rendered without `processing`. No new rows or logic.
- `src/components/panels/SourcePanel.tsx`: no source -> "Connect a source to see its settings." (replaces "Choose a source to see its settings.").
- `src/components/StatusBar.tsx`: `startup !== 'ready'` with no frame -> no items (an empty bar). Before, the start-up
  status showed "No source connected." while the backend had not answered. S13 still shows "No source connected.".
  The copy of `noDataText` is unchanged.

## Tests

- `SpectrumView.test.ts` (rewritten, 5 tests): `ready` + disconnected -> "Not connected. Use the source button to connect.";
  `loading` and `unavailable` -> null (with a `noSource` liveness kind); a frame, or a connecting source -> null; the
  Continuous/Single copy unchanged.
- `CaptureControl.test.tsx` (+2): status null (start-up) -> main and chevron disabled, title and accessible description
  "Loading…"; `launching` + disconnected -> "Loading…", and after launch ends -> "Connect a source first".
- `MeasurementPanel.test.tsx` (+1): launching + disconnected -> Center and Span disabled with em dash, capture reason
  "Loading…", no Averaging row. (The test title says device rows; FFT/Window reasons go through the same function, not separately tested.)
- `SourcePanel.test.tsx` (+1, file from 014 T3): "Connect a source to see its settings." with no source; the old copy absent.
- `StatusBar.test.tsx` (+3): status null (start-up) -> empty bar; launching -> empty bar, then "No source connected." once the
  status is out of launch; `startupFailed` (S12) -> empty bar.
- `App.test.tsx`: the plot-hint expectation changed to the new copy (the default status is ready and disconnected).

## Check results

- `npm run check`: exit 0. Log: `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/4c0a989e-67c9-4b64-9595-d4ba9bcd2b0d/scratchpad/check-015-t4.log`
  (the scratchpad folder). Rust: fmt, clippy `-D warnings`, `cargo test --workspace` pass. Bindings: unchanged. Prettier, ESLint
  (`--max-warnings 0`), `tsc --noEmit` (app and e2e), Vitest: 58 files, 798 tests passed.
- Targeted Vitest before the gate: `src/components`, `src/components/panels`, `src/components/capture`, `App.test.tsx`: 16 files, 273 tests (after fixing one assertion), all passed.
- Real app and e2e: not run (T5 owns e2e; no visual check of the start-up copy). Not verified at 1024 / 1180 / 1440.

## Deviations and why

- `plotHint` loses its `noSource` parameter. The first argument is now `Startup`. A selected, not connected source is
  `state === 'disconnected'`, so the old "no source" branch is covered; the old empty-`active` case cannot reach the hint after
  start-up. The liveness "No source connected" tag is not touched.
- `MeasurementPanel` device and FFT reasons now say "Loading…" during start-up. The task says "only add what is missing";
  this was missing against the 014 design row for Loading.
- `StatusBar` was changed in code, not only tested: the S0 and S12 bar was "No source connected." before, not empty.

## Retired copy (grep "Choose a source") after T4

- `src/components/source/SourceButton.tsx`: the commented fallback label (T2), as the task allows.
- `src/components/source/SourceButton.test.tsx`, `SourceMenu.test.tsx`, `MeasurementPanel.test.tsx:339`: assertions on the
  fallback label (T2 kept them: "no simulator driver" case). Not user-visible copy in the shipped app.
- `src/ui/SplitButton/SplitButton.stories.tsx:84`: a Storybook sample text "Choose a source to begin…". Outside T4's file list
  (`src/ui`); not changed. PM or a later task should replace it.
- `docs/user-guide.md:6` and `:46`: "Choose a source" in the user guide. Left for T5 (docs).
- `e2e/specs/acquisition.e2e.ts:32`, `e2e/specs/add-source.e2e.ts:132`, `e2e/specs/helpers.ts:150` (comment): e2e, T5.
- `DESIGN.md`: the status rows for the retired copy are design history; not edited here.

## Open for QA / the PM

- S12 (backend silent): the status bar and the capture control reason. The bar is empty (as design S12). The capture reason is
  still "Connect a source first", because the task said to keep `noSourceTitle` unchanged otherwise. Design section 5 S12 gives no
  capture reason, so the PM should confirm whether "Status unavailable" should be the reason there.
- The launch-connect "Loading…" window (`launching` + disconnected) is short in practice; QA should check that the bar, the
  button and the capture control all switch together when the connect begins.
