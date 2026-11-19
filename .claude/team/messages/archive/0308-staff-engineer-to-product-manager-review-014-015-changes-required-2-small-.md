---
id: 0308
from: staff-engineer
to: product-manager
type: report
subject: Review 014+015: changes required (2 small fixes)
work: 015-default-simulator
reply-to: 
date: 2026-11-19T02:45:55-03:00
---

# Review: 014 measurement param rows (#45) and 015 default simulator (#46)

Reviewer: staff-engineer. Scope: the uncommitted working tree, both work items, against plans, tasks,
ADR 0017/0018 and CLAUDE.md.

## Verdict: CHANGES REQUIRED (two small, targeted fixes; everything else approved)

`npm run check` passes on the working tree (fmt, clippy, cargo test, bindings regenerated, Prettier,
ESLint, tsc, Vitest; exit 0). Bindings (`ParamSpec.ts`, `ParamPlacement.ts`, `SessionStatus.ts`) are
regenerated and present.

## What was checked and is fine

- Boundaries: no UI code reads `driverId`/device names for behaviour. Placement is a generic
  `ParamSpec.placement` hint (default `Source`, `#[serde(default)]`, round-trip and legacy tests). The
  simulator fallback is found by `DriverInfo.kind == Simulator && status == Available`, never by id.
  `src-tauri` needed no change.
- Backend: `may_replace` is the single predicate used by `connect_if_idle` (checked under the worker
  lock) and `Policy::keeps_source`; acquiring and real devices are never replaced; a found-but-failing
  device gets no fallback; unplug gives no fallback; `launching` is cleared after `contain("launch")`
  (so also on panic) and on spawn failure. Tests cover each plan item, including races and the
  panic case. The old "does nothing" tests were rewritten to the new rules, not weakened.
- Validation unchanged and still in Rust (`resolve_params`/`check_partial`); Measurement rows send
  through the same `applySettings({params})` path.
- Design system: one `ParamField` shared by Source settings and Measurement; `NumberField` `null`
  value and unit description are a small, tested `src/ui` change with Storybook; no new component,
  no near-duplicate, tokens only.
- Docs: ADR 0017/0018, `sources.md`, `architecture.md`, `user-guide.md`, `testing.md`, DESIGN.md
  updated; stale "Choose a source" mentions remaining are intentional (retired-copy notes).

## Required fixes

1. **S12: Measurement device/FFT rows must read "Status unavailable" (PM decision).**
   File `src/components/panels/MeasurementPanel.tsx`, function `unavailableReason`: it handles
   `loading` but a failed start-up (`startup === 'unavailable'`) falls through to "Connect a source
   first", which is wrong (the capture control and source button already say "Status unavailable").
   Add `if (startup === 'unavailable') return 'Status unavailable';` right after the `loading`
   line (before the `connecting`/`disconnecting` checks), and update the function doc comment.
   Test in `src/components/panels/MeasurementPanel.test.tsx`: with `startupFailed: true` and
   `status: null`, the Center field, Span select, and (for a cached trace/IQ driver or the
   reduced set) the device rows expose the reason "Status unavailable" in their tooltip and
   accessible description; assert it is not "Connect a source first". Today no test covers S12 here.

2. **`analyzerAtLaunch()` must use the session status, not the source name.**
   File `e2e/specs/helpers.ts` (`analyzerAtLaunch`): `!/simulator/i.test(sourceButtonText())` couples
   launch-state specs to display copy (the title comes from user names, device labels or the driver
   name) and contradicts the principle of ADR 0017 (the simulator is identified by what it is, never
   by a name). The UI does not expose `source.simulated` in the DOM yet, so:
   - `src/components/source/SourceButton.tsx`: add `data-simulated="true"` (attribute present only
     when `status.source?.simulated` is true) to the source button in the ready branch; no visual change.
   - `src/components/source/SourceButton.test.tsx`: assert the attribute for a simulated source and
     its absence for a real one.
   - `e2e/specs/helpers.ts`: `analyzerAtLaunch` returns
     `(await sessionState()) === 'Connected' && (await byTestId('source-button')).getAttribute('data-simulated') === null`
     (adapt to the helpers' await style); update its doc comment. No spec changes needed
     (callers: `acquisition`, `persistence`, `startup` e2e).

## Optional notes (no change required for approval)

- `src/state/session.ts` `receiveStatus` calls `sources.refresh()` on every status whose live source
  is not in the remembered list. If the backend ever fails to remember a connect (store write error),
  that is one `listSources` per status event until a restart. Consider a guard (once per
  identity, or only when `previous?.source` differs). Low risk; file as a follow-up candidate for the PM.
- `crates/spectrum-driver-sa430/tests/autoconnect.rs` has no replace-idle-simulator test with the real
  driver (the core fake covers the rule; the dev noted this). Fine; mention to QA for the hardware pass.
- Candidate follow-ups already in the plans (not in scope): persist the last known data kind per
  driver across launches; a setting to disable the launch fallback.
