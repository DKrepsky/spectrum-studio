---
id: 0013
from: developer
to: staff-engineer
type: handoff
subject: T4 done: source button, menu, inline form
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:35:06-03:00
---

T4 implemented, uncommitted in the working tree. Web checks green; the full `npm run check` fails only on a flaky Rust test from T1 (below).

## Changes
- New `src/components/source/`:
  - `SourceButton.tsx`: dot, name and ▾. Accessible name is `Source: <name>, <state>`. A one-time accent outline shows until the first pick.
  - `SourceMenu.tsx`: Your sources (rows with Rename and Forget), Detected devices, a fixed block (Signal simulator, Open file…, Other sources…) and Disconnect. Scans only while mounted/open. Contains the 5 s Undo toast, rename input, "Other sources" pick list and Open file… logic.
  - `SourceForm.tsx`: uses `ParamForm` with `idPrefix=conn-<driverId>`.
  - `useMenuKeys.ts`: a DOM-driven keyboard hook, kept in one place as the plan asked. Covers Up/Down wrap, Home/End, type-ahead, Escape, Tab, F2, Delete and Left/Right into the row actions.
  - `status.tsx`, `menuState.ts` (open state shared with Ctrl+K), tests in `SourceMenu.test.tsx`.
- Edited: `Toolbar.tsx` (SourceButton replaces the selector and Connect/Disconnect/Switch; Run disabled with title "Choose a source first" when there is no active source), `App.tsx` (dialog state removed, Ctrl+K), `NoticeBanner.tsx` (no `Sources…`; Reconnect uses `remembered` id, else `lastConfig`), `SourcePanel.tsx` text, `SpectrumView.tsx` (`plot-hint`), `app.css` (old modal/sources CSS removed, new menu CSS).
- Deleted: `src/components/sources/**` and `SourceSelector.tsx`. `TRANSPORT_LABEL` and `fileDriverFor` come from `state/sourceEntries`.
- Tests: `Toolbar.test.tsx` and `NoticeBanner.test.tsx` updated, new `App.test.tsx` (Ctrl+K and hint), `SourceMenu.test.tsx` with 34 cases:
  - first launch, Planned never rendered, pick/connecting/failure/busy;
  - Disconnect item, detected and absent rows, scan error;
  - keyboard: open, arrows, Home/End, type-ahead, Escape, Tab, outside click, row actions;
  - Forget/Undo/expiry, Rename (F2, Escape, empty);
  - Other sources list, hidden when empty, single-driver shortcut, form required/Show more/error/Connecting/Back/Escape/Cancel, Open file… (extension rule, cancel, raw IQ prefilled form);
  - a seeded simulator entry with failConnect.
- Bindings untouched; `src-tauri`, `crates` and `e2e` untouched.

## Check results
- Prettier, ESLint, `tsc` and Vitest (19 files, 128 tests) all pass.
- `npm run check` stops at `cargo test`, which is flaky. `store::tests::remembering_creates_then_touches_the_same_identity` in `crates/spectrum-core/src/store.rs:872` (T1) failed in 4 of 6 full runs and passed in isolation twice. The only difference in the failure output is the last digits of `created_ms` (`...37.621` vs `...37.6213`), so it looks like a float round-trip through JSON in an equality assert. Please have T1 compare with a tolerance or use integer ms. I did not touch `crates/`.
- The e2e `tsc` step was not reached because of that failure; T5 still has to update e2e.

## Deviations and concerns
- Open file… is hidden if no file driver is available (the design says always visible). Other sources… is hidden per the revised task.
- Detected rows use test id `source-detected-<driverId>-<deviceId>`, with the raw deviceId, so it contains slashes for SA430 (`source-detected-sa430-/dev/ttyACM0`). For the "Other sources" pick list I used `source-pick-<driverId>` and `source-other-back`.
- Rename and Forget have aria-labels `Rename <name>` / `Forget <name>`; the test ids are not unique per row (`source-rename`, `source-forget`), so e2e must scope them to a row.
- The Undo toast sits at the forgotten entry's old position (by `lastUsedMs`). Focus moves to Undo after Forget.
- A detected device whose driver has required connection params opens the form with the deviceId kept.
- The state pill and ◌ for a lost device use `lastNotice.kind === 'deviceLost'` while disconnected.
- The `.spinner` glyph is ⟳, animated; with `prefers-reduced-motion` it is a static `…`.
- Contrast: `--text-muted` on `--surface-2` is about 5.6:1 by my calculation. I did not check it in a browser.
- Not verified in the real app or via e2e (webkit driver not run).
