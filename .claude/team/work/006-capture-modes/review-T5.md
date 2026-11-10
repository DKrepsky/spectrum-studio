# Review T5 (006 capture modes): e2e, docs, two small fixes

Verdict: **APPROVED** (two non-blocking nits, one follow-up recommendation). Read-only review of the
diff; I did not launch the app or e2e. Developer reports `npm run check` green (183 Rust, 247 Vitest).

## Against T5 / plan section 5
- helpers.ts: `captureMode`, `chooseMode` (waits for the backend-driven `data-mode` and menu close),
  `frameSeq` as specified. Good: the UI is asserted from status, not assumed.
- acquisition/persistence/sa430 specs: SIMULATED expectations removed; single flow checks end state
  and frame seq +1 with no further frames (correct given the simulator sweep is near-instant, plan
  risk 1); mode lock, menu keyboard, persistence of both modes across restart are covered.
- visual.e2e.ts: new guard asserts constant control width/height across modes at 1180 and 1024, menu
  inside window, no overflow, screenshots. This is the plan risk 5 guard. Comment/title updates fine.
- sa430.e2e.ts: new hardware single-sweep test asserts dBm, not "Uncalibrated", idle, no further
  frames. The fix to "restores the retuned centre frequency" (select the remembered row before Play)
  is a legitimate pre-existing defect, since the app never auto-connects. Hardware gating unchanged.
- Docs: sources.md paragraph matches the plan (sweep = one read, 30 s bound, cancel discards).
  architecture.md, roadmap (In QA, limitations), testing.md, user-guide.md and the ADR 0005
  supersession note are accurate and stay within what the code does. The extra files beyond the task
  list were stale text; acceptable.

## Small fixes
- CaptureControl: failure no longer in the live region (the role=alert notice speaks it); complete
  and cancelled stay. Matches PM decision. Test asserts `textContent === ''`.
- `stop()` now returns `Promise<boolean>` (`command` result); the cancelled flag is reset when Stop
  fails, so the end is announced as complete. Type change is backward compatible (other callers
  ignore the value). New test covers it. Approved.

## Pre-existing claim for the 5 e2e failures: plausible, accepted
Evidence by reading, not rerunning:
- `git diff` shows no change in `src/components/source/*` or `e2e/specs/source-row.e2e.ts`; the
  source menu, source button (`aria-label` from SourceButton) and row CSS (`:focus-within`, badge
  fade) are untouched by 006. Toolbar only swaps the Play button/badge for `CaptureControl`.
- Hover-under-badge is a documented known defect in the roadmap and the visual spec comment.
- The three "source button never showed Bench SA430 analyzer 2" cases wait on the source button
  label after selecting a seeded SA430 entry that cannot connect; this goes through SourceButton /
  menu / connect failure, none changed here. The developer additionally reproduced all 5 with
  identical messages on a `git archive HEAD` build. I accept that as pre-existing, with the caveat
  that I cannot independently confirm (no rerun). A real SA430 is attached on /dev/ttyACM0 on this
  machine, which may influence seeded-SA430 picks; worth noting when triaging.
- Both are properly recorded in roadmap Known limitations. Decision (PM): fix is out of scope for 006;
  prefer a follow-up work item rather than `skip`, so the suite is honestly red until fixed or
  explicitly quarantined. If the PM wants a green suite for release, mark them `it.skip` with a
  comment pointing at the roadmap entry; do not silently loosen assertions.
  Note "Edit is not focus-within its row" (ArrowRight onto Edit) may be a real keyboard-accessibility
  bug, not just a test issue: higher priority than the badge cosmetic.

## Flake `unplugging_the_analyzer_disconnects_the_session`
Test waits 5 s (WAIT) for Disconnected after the scripted unplug. Reported failure (state stayed
Connected, notice "did not answer in time") means a timeout read error was classified non-fatal
before the unplug error, i.e. it looks like a classification race in scripted-backend/worker under
CPU load, independent of capture mode (continuous mode path, test unchanged except imports). Not a
blocker. Follow-up: have the SA430 driver/test make unplug deterministic (fatal error on all reads
once `unplugged`), or raise the bound; QA/dev to loop it ~50x under load before release. Ensure the
single-capture changes in worker.rs did not alter the continuous read-error path (Rust tests cover
fatal -> DeviceLost per plan).

## Nits (non-blocking)
1. sa430.e2e.ts: missing blank line before `it('captures one real sweep ...` (Prettier may not
   catch it; cosmetic).
2. `visual.e2e.ts` single-mode test uses fixed `browser.pause(300)`; acceptable but prefer
   waitUntil on width stability if it ever flakes.
