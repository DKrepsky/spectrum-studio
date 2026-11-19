# 015 T5 developer report: e2e budget and docs for the new launch state

Spec: `tasks/T5.md`; `plan.md`; ADR 0017; 014 `dev-T3.md` (e2e edits made without a run, now run).
Not committed. Shipping gate: `npm run check` green; `npm run e2e` green (110 passed, 0 failed, 17 skipped).

## Result summary

- `npm run check`: exit 0 (Rust fmt, clippy, cargo tests; Prettier, ESLint, `tsc` app and e2e; Vitest 58 files, 799 tests).
  Log: `/tmp/claude-1000/-home-kr-workspace-spectrum-kit/4c0a989e-67c9-4b64-9595-d4ba9bcd2b0d/scratchpad/check-t5-1.log`.
- `npm run e2e` (default, SA430 not gated, debug binary rebuilt): exit 0, 12 of 12 spec files passed.
  Passing 110, failing 0, skipped 17. Log: `.../scratchpad/e2e-full-2.log`.
  - Skipped by design: `sa430.e2e.ts` 10 (env gate `SPECTRUM_E2E_SA430`), `add-source` 2 and `visual` 3 hardware or placeholder cases,
    and 2 analyzer-launch pending tests (below).
- Hardware runs (`SPECTRUM_E2E_SA430=1`, device attached): `sa430.e2e.ts` 10 passing 0 failing (`.../e2e-sa430.log`);
  `add-source` + `visual` 57 passing, 1 skipped (`.../e2e-hw-2.log`). The busy-port test (new) passed, so the Failed path is real.
- **Not verified here: the default suite with no analyzer attached.** The SA430 is on this machine (lsusb 2047:0005), so the
  no-device launch cannot be produced (no root, no code switch for discovery). See "Device isolation" below.
- Flaky #24 / #42 not seen in these runs; not chased.

## Device isolation (decision, needs PM confirmation)

- No env or app switch exists to hide discovered devices at launch (`src-tauri` and core read no env). A plain launch on this
  machine connects the SA430, so the no-device launch assertions cannot run here.
- Chosen: those launch-state tests check `analyzerAtLaunch()` (new helper in `helpers.ts`) and call `this.skip()` when an analyzer
  connected at launch. Pending, reported by wdio, never silent. Two tests: `acquisition.e2e.ts` "starts with the simulator selected
  and connected, not acquiring" and `startup.e2e.ts` "starts with the simulator selected and connected...". Every other test passes
  with or without an analyzer.
- Not chosen (PM call): an e2e-only launch switch in the shell (e.g. `SPECTRUM_E2E_NO_DEVICES=1`) so the default suite can run the
  no-device launch on this machine. It is a product code change in `src-tauri`, so I did not add it.
- Still to do by a human or QA: run `npm run e2e` with the SA430 unplugged to exercise the two pending tests and the no-device
  branch of `persistence.e2e.ts` ("restores preferences...", the `else` branch with the simulator connected by the launch fallback).
  That branch follows ADR 0017 but has not run.

## What changed

Feature code (PM decisions on T4 open items):
- `src/components/capture/CaptureControl.tsx`: `noSourceTitle` returns "Status unavailable" when `startup === 'unavailable'` (S12).
  Before: "Connect a source first". Test added in `CaptureControl.test.tsx` (`startupFailed` with `status: null`: title, accessible
  description and chevron all read "Status unavailable").
- `src/ui/SplitButton/SplitButton.stories.tsx`: sample copy "Choose a source to begin…" -> "Capture needs a connected source."
- `docs/user-guide.md`: first run rewritten (Loading…, connected at start-up); new "Start-up" section (always a source, analyzer
  or simulator at launch, idle simulator replaced, acquiring never interrupted, busy device Failed with no fallback, unplug,
  Disconnect keeps selection); Forget of the selected, not connected source selects the simulator; "Signal simulator" entry text;
  "On the next start" paragraph; the Simulator section.
- `docs/testing.md`: "What a spec starts from" (launch connects, `ensureDisconnected` keeps selection, `runSimulator`,
  seeds), "Launch-state specs and an attached analyzer" (pending), "Manual start-up checks" (pointer to the sa430 header), and the
  hardware-spec list now names the Frequency step and busy-port cases.

e2e:
- `e2e/specs/helpers.ts`
  - `waitForAppReady`: also waits until the source button no longer reads "Loading…" (plus the launch settled wait).
  - `runSimulator()`: `ensureDisconnected()` then `selectSource('source-simulator')`; the remembered-row branching is removed.
  - `analyzerAtLaunch()` (new): true when connected to something that is not the simulator.
  - `ensureDisconnected`, `sessionState`, `sourceButtonText`, `waitForLaunchSettled` comments updated (no "Choose a source" or "without a chosen source").
  - `findOverflow` skips `.visually-hidden` text: it is clipped by design. A 014 T3 help description triggered it and cascaded through
    the visual guard (open menu intercepted). Visual went from 37 pass / 10 fail to 47 pass / 0 fail after this change alone.
- `e2e/specs/acquisition.e2e.ts`
  - first test rewritten (launch state; pending with an analyzer), button name `Source: Signal simulator, Connected`, `stopped`
    liveness, plot hint "No trace yet. Press Continuous to start acquisition.", capture enabled.
  - FFT/Window test renamed "...once disconnected, as Center and Span are": liveness `stopped` with HOLD text (a trace is on screen,
    so `noSource` is no longer the state). Assertions on disabled state and reason are unchanged.
  - Measurement layout test: rows are inside `.measurement-rows` (014 T3 wrapper); capture is its last item (`closest role=group`).
    The assertion that the capture control is the last item is kept.
  - last test is now "disconnect keeps the selection": name `Source: Signal simulator, Disconnected`, disabled capture with
    "Connect a source first", and (after a connect that clears the trace, then a disconnect) the plot hint "Not connected. Use the
    source button to connect."
- `e2e/specs/add-source.e2e.ts`: "forgetting the selected, not connected source..." now expects `Source: Signal simulator, Disconnected`
  (ADR 0017); the `Choose a source` assertion is gone; file header comment updated.
- `e2e/specs/persistence.e2e.ts` + new seed `e2e/fixtures/seed/persistence/sources.json` (version 2, one named simulator preset
  "Bench FM setup"). Reason: an unnamed simulator is never listed under Your sources, so rename/forget/undo need a named entry.
  - "remembers ... the fixed simulator row stays offered": the preset is listed by name and the fixed row is displayed; the
    unnamed "Signal simulator" is not listed under Your sources.
  - restart test: the launch branch is `analyzerAtLaunch()` (SA430 branch, unchanged) or the preset connected by the launch
    fallback (no-device branch, ADR 0017; not run here).
- `e2e/specs/sa430.e2e.ts` (env-gated)
  - header: automated list (launch connects the analyzer; busy port -> Failed) and four manual steps (unplug with nothing connected;
    plug over an idle simulator; plug during a capture; unplug during acquisition). Only the plug/unplug cases are manual.
  - first test: asserts the selection is the analyzer (not the simulator), and the fixed row is not that source.
  - new test "a device whose port is busy fails into Failed and stays selected, with no simulator fallback": a python3 helper
    holds `/dev/ttyACM0` with TIOCEXCL (`holdPort`, killed in `finally`), the pick fails with one banner, the row reads Failed, the
    name ends `, Failed` and contains no simulator; after release the same row connects.
- `e2e/specs/startup.e2e.ts` (new, no seed): (1) no analyzer -> simulator selected, Connected, not acquiring (pending with an
  analyzer); (2) `reloadSession` with a MutationObserver recording the source button label: never "Choose a source", every
  recorded label is `Loading…`, `Status unavailable` or `<name>, <state>`, final state Connected; (3) the fixed row is `aria-current`
  in the group "Add a source" while the simulator is selected (runs `runSimulator`, so the row reads Acquiring); (4) Disconnect keeps
  the simulator selected and not connected.
- `visual.e2e.ts`, `edit-source.e2e.ts`, `migration*.e2e.ts`, `failures.e2e.ts`, `source-row.e2e.ts`, `status-bar.e2e.ts`: no change.
  Each passes after the helper fix; their launch assumptions were already `ensureDisconnected()`-based. Shot names are unchanged.

Baseline before these edits (same binary family, no spec changes): acquisition 2 failing, add-source 1, persistence 5, visual 10
(the 10 visual ones mostly cascaded from the visually-hidden overflow, see above), 0 for the rest.

## Checks not done / open for the PM and QA

- README screenshot: `npm run docs:screenshot` not run and the README not changed. The task says ask the PM if the output changed
  meaningfully; the start-up state now shows the connected simulator in the side panel. PM to decide.
- Start-up failure (S12) copy in `MeasurementPanel.tsx`: device rows and FFT/Window still say "Connect a source first" when
  `startup === 'unavailable'`. The PM decision covered only the capture control. Left unchanged; one-line change if wanted.
- Remaining "Choose a source" in `e2e/`: only as negative assertions (`not.toContain`) and one comment in `startup.e2e.ts`.
  No assertion expects the retired copy.
- `docs/user-guide.md` and `docs/testing.md` mention "Choose a source" only to say it is retired.
- `analyzerAtLaunch()` treats any connected source whose name lacks "simulator" as an analyzer. A named simulator preset
  connected at launch would count as an analyzer; no current spec does that, so it is noted, not guarded.
- The no-device launch (startup test 1, acquisition test 1, persistence no-device branch) is unverified on this machine: it needs
  the SA430 unplugged. QA run with the cable out is the way to close it.

## Files touched (no commit)

- `src/components/capture/CaptureControl.tsx`, `src/components/capture/CaptureControl.test.tsx`
- `src/ui/SplitButton/SplitButton.stories.tsx`
- `e2e/specs/helpers.ts`, `e2e/specs/acquisition.e2e.ts`, `e2e/specs/add-source.e2e.ts`, `e2e/specs/persistence.e2e.ts`,
  `e2e/specs/sa430.e2e.ts`, `e2e/specs/startup.e2e.ts` (new), `e2e/fixtures/seed/persistence/sources.json` (new)
- `docs/user-guide.md`, `docs/testing.md`
- Memory: `.claude/agent-memory/developer/e2e-quirks.md` (section added for 015 T5)

## Review fixes (014 + 015, review.md, request 0309)

Scope: the three items of the request. No commit.

1. **S12 "Status unavailable" on the Measurement device rows** (`src/components/panels/MeasurementPanel.tsx`,
   `unavailableReason`). A failed start-up (`startup === 'unavailable'`) now returns "Status unavailable" before the
   connecting checks, so the device rows (title and accessible description) read the same words as the source button and
   the capture control. Test: `MeasurementPanel.test.tsx`, "says Status unavailable, not Connect a source first, on the
   device rows when start-up failed (S12)" (cached sa430 trace caps, `status: null`, `startupFailed: true`). Center and
   Span are disabled and never say "Connect a source first", but they carry no reason text in any state today (the reason
   is only on the tooltip of Span for a fixed span, and Center has none), so they are asserted for the absent wording only.
   FFT size and Window need a live `processing` value, so start-up failure does not render them.
   DESIGN.md 5.2.10 (line ~634) now names "Status unavailable" for the start-up case.
2. **`data-simulated` on the source button** (`src/components/source/SourceButton.tsx`): `data-simulated="true"` only
   while `status.source?.simulated === true`; absent otherwise, no visual change. Test in `SourceButton.test.tsx`:
   "marks the button data-simulated only while the live source is the simulator" (simulated, then a real source, then
   none). `analyzerAtLaunch()` in `e2e/specs/helpers.ts` is now `Connected && data-simulated === null`; its doc comment says
   the simulator is identified by the attribute. Callers unchanged (acquisition, persistence, startup).
3. **Dedupe of the unknown-source reload** (`src/state/session.ts`, `receiveStatus`). New store field
   `listReloadedFor` (the `JSON.stringify` of the live source's config). A live source missing from the remembered list
   calls `sources.refresh()` only when the key differs from `listReloadedFor`; a known live source or no source clears
   the mark, so a source that goes away and comes back unknown reloads again. Tests in `session.test.ts`: "reloads the
   list once per unknown live source, not on every status that repeats it" and "reloads again after the live source is
   gone and comes back unknown"; `beforeEach` resets `listReloadedFor`. The original "reloads the list ... and not again
   once it is" test still passes.

### Checks

- `npm run check`: exit 0. Vitest 58 files, 803 tests passed (includes the new ones). Log copied to the scratchpad.
- Unit tests of the three touched files: 94 passed before the full run.
- `npm run e2e` (full suite, `webkit2gtk-driver` 2.52.6 extracted from the Ubuntu archive into the scratchpad and put on
  PATH; no system install): **10 of 12 spec files passed, 2 failed**. Total log: `e2e-full.log` in the scratchpad.
  - `acquisition` 21 passed. `persistence` 5 passed. `startup` 4 passed (the three specs touched by fix 2).
  - `add-source` 6 passed, 2 pending (the real-port cases need the analyzer).
  - `sa430` 10 pending: env-gated, the SA430 is not attached on this machine (`/dev/ttyACM*` absent). **The SA430-attached
    run is not done.**
  - `visual` 46 passed, 1 failed, 3 pending (needs two SA430 analyzers). The failure is
    "source button, menu and dialog hover and focus move nothing ... at 1024px" (`waitForActionsSettled`, the hover-actions
    defect that the e2e notes already record as red on main). Not caused by this pass.
  - `migration-dup` **FAILED** (2 passed, 1 failed): "wrote version 3 with one record and left a backup of the old file"
    expects one record in `sources.json`, but there are two: the SA430 row and a `Signal simulator` row created at launch.
    The launch fallback now remembers the simulator (`remember::auto_connect_config`, new in the uncommitted tree under
    015). The spec was not touched in this pass and is outside the fix list, so it is left as is. Suggested fix for the
    owner: count only the `sa430` records in the assertion (or seed the store so the launch fallback does not add one).
    This failure is caused by the 015 working tree, not by these three fixes.

## QA fixes (BUG-QA-1, FIND-QA-2)

Inputs: `qa.md`, messages 0312 and 0314, and the PM request "QA fix pass 014+015" (0316). Not committed.

### BUG-QA-1: migration-dup counts device records

- `e2e/specs/migration-dup.e2e.ts`, "wrote version 3 with one record": the `sources.json` assertion now filters
  `config.driverId === 'sa430'` and expects one device record. The launch fallback's unnamed simulator record is
  kept (PM decision; R10). The backup assertions (`pre-v3` file, version 2, two records) are unchanged.
- No product code changed for this bug.

### FIND-QA-2: held trace after Disconnect shows "No source connected"

- `src/state/liveness.ts`: `liveness()` gets an optional `deviceLost` flag (default false). When the state is
  `disconnected` and the device was not lost, the tag is `noSource` / "No source connected" even with a held frame.
  Otherwise the existing rules apply (HOLD for a connected, stopped session with data; the S10 device-lost trace
  stays HOLD). `useLiveness` takes the same flag.
- `src/components/SpectrumView.tsx`: passes `deviceLost` = `lastNotice.kind === 'deviceLost'` (the same test
  `SourceButton` and `SourceMenu` use for "Not detected"). `plotHint` is unchanged: it already returns null while a
  frame is held, so no hint shows over a trace.
- Why the flag: `disconnected` is also the state after a device is unplugged, and DESIGN.md 5.2.7 (S10) keeps that
  trace as HOLD. Keying on `state` alone broke S10.
- Tests: `src/state/liveness.test.ts`. "marks retained frames as held when connected but not acquiring" (connected
  only); "says no source is connected after Disconnect, even while a held trace stays on screen (S13)" (with and
  without a frame); "keeps a lost device's trace as HOLD (S10), but not a disconnected one". `plotHint` tests
  already cover "no hint once a trace is on screen" for disconnected.
- e2e: `e2e/specs/acquisition.e2e.ts`, "disconnect keeps the selection": the held-trace assertion now expects
  kind `noSource` and text "No source connected" (was HOLD). The comment about the hint is updated.
- `DESIGN.md` S13 row: the tag applies over a held trace; the hint shows only while no trace is shown. This is the
  only text change in DESIGN.md; the S13 text in `design.md` already matched.

### Checks

- `npm run check`: exit 0 (Vitest 58 files, 805 tests passed). Log: `evidence/check-qa-fix.log`.
- `npm run e2e` (after `tauri build --debug --no-bundle`, WebKitWebDriver from the scratchpad extraction on PATH):
  - Run 1 (`evidence/e2e-qa-fix.log`): 11 of 12 spec files passed. `persistence` failed 3 tests. The first one
    ("renames a remembered source through the Edit dialog") failed with "the row actions did not appear" (hover
    actions in `revealRowActions`), so the next two failed on the name it never set. The spec passes alone (5 of 5,
    `evidence/e2e-persistence-rerun.log`).
  - Run 2 (`evidence/e2e-qa-fix-rerun.log`): **12 of 12 spec files passed**, 0 failing. Skipped: 2 (`add-source`),
    10 (`sa430`, env-gated, no SA430 attached), 3 (`visual`, need two SA430 analyzers). Test count: 21 + 6 + 4 + 3
    + 3 + 3 + 5 + 11 + 4 + 5 + 47 passing.
  - The `persistence` failure in run 1 is the known hover-action flake (`revealRowActions`, see the e2e notes).
    Not reproduced in run 2 or alone. It is not caused by these edits (the menu and the Edit path are unchanged),
    but it has now shown up once in a full run, so it is open for the next QA pass.
- Not run: the SA430-attached checks (unplugged). The S10 device-lost HOLD path is covered by the unit test only; it
  needs a real unplug to exercise end to end.

## SA430-run fixes (request 0320, after qa.md "SA430-attached run")

Scope: blocking item 1 of the SA430-attached QA pass (launch guard race), the 014 / DESIGN.md
alignment the PM decided, and a cheap guard against cascades in the acquisition spec. No product code
changed; the app binary is the same.

### Changes

- `e2e/specs/helpers.ts`, `analyzerAtLaunch()`:
  - It now waits (bounded, 10 s, every 100 ms) until the source button's accessible name ends in
    `Connected` or `Failed`, then decides. The launch connect starts after the first status
    (Disconnected, then Connecting…), so the old check ran too early. Without a device the simulator
    reaches Connected in about a second, so the no-device launch still runs for real.
  - Found while fixing it: the `data-simulated` read was not awaited (`getAttribute` returns a promise),
    so `simulated === null` was always false. The guard therefore never returned true. This is fixed too.
  - `Failed` is included on purpose: a device that failed at launch is an analyzer-at-launch case, so the
    no-analyzer expectations are skipped (the busy-port case is covered by `sa430.e2e.ts`).
  - Still keyed on `data-simulated`, not on the device name.
- `e2e/specs/acquisition.e2e.ts`: an `afterEach` closes the source menu (`closeSourceMenu()`), so a failed
  test cannot leave the menu open and intercept the clicks of the next ones. This is a guard, not a proven
  root cause of the QA cascade. With the launch guard fixed, the cascade is not reproduced (see below).
- `DESIGN.md`:
  - Section 3.6 (kind rows, the bullet "no kind has been reported"): states that a source not opened this run
    has its kind rows hidden (a device that failed at launch, or a remembered one after a restart), that only
    the rows every source has are shown, and that showing them disabled is #47.
  - Section 4.4 "Range message" bullet: a known-gap note that today an invalid NumberField shows the border and the
    tooltip only; the visible message is #48. Kept only where DESIGN.md already claims a visible message.
  - Section 8.2 copy table, the "Frequency step, Reference level with no source (014)" row: "when the source was opened
    this run; otherwise hidden (follow-up #47)".
- `.claude/team/work/014-measurement-param-rows/design.md`, section 6 state table: the kind-row cells of
  Connecting, Error (connect failed), Disconnected (selected) and Device lost are marked `(*)`, with a note
  under the table: the table is the target; today the kind rows show only when the source was opened in
  this run; showing them disabled is #47.

### Checks

- `npm run check`: exit 0 (after the edits above).
- `npm run e2e` (debug build via the script, WebKitWebDriver from the scratchpad extraction on PATH, SA430
  attached on `/dev/ttyACM0`): **12 of 12 spec files passed, 0 failed**, 2 min 48 s.
  - `acquisition`: 20 passing, 1 pending ("starts with the simulator selected and connected, not
    acquiring"). The 8 later tests that cascaded in the QA run pass.
  - `startup`: 3 passing, 1 pending (the no-analyzer launch test).
  - `persistence`: 5 passing. Test 1 ("restores preferences, the last source...") now takes the
    analyzer branch (SA430 label, then disconnect) and passes; it is not pending. This is intended: the
    restore assertion holds in both cases.
  - `sa430`: 10 passing (the full run also ran it).
  - Logs: `evidence/fix-pass-sa430/e2e-full-015-fix.txt`.
- `SPECTRUM_E2E_SA430=1 npx wdio run e2e/wdio.conf.ts --spec e2e/specs/sa430.e2e.ts`: **1 file passed,
  10 passing, 0 failing** (26 s). Log: `evidence/fix-pass-sa430/e2e-sa430-015-fix.txt`.

### Not done / notes

- The launch-state guard is not run with the device unplugged in this pass (the no-device branch was run
  by QA in the earlier no-device run; the full run here ran with the device attached). The pending tests
  are the expected outcome with the device attached.
- No commit (per the request). Nothing staged.
- FIND-SA-1 (kind rows hidden for a device with no known capabilities) is not changed here; the docs now
  describe it as current behaviour with #47 as the fix. FIND-SA-2 is #48 (only the DESIGN.md claim is noted).
