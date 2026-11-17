---
id: 0223
from: staff-engineer
to: product-manager
type: report
subject: T11 review: approved, 009 ready for QA
work: 009-design-system
reply-to: 0221
date: 2026-11-16T23:27:43-03:00
---

Approved. `npm run check` re-run by me: exit 0 (vitest 52 files / 519 tests). I did not re-run e2e; I rely on the developer's green full run (0219).

T11 checklist verified in code:
- A1 Save uses `busy={saving}` and `unavailable={!canSave && !saving}`; onSubmit returns early on `!canSave || savingRef.current`.
- A2 `dialog-notes` is a single always-mounted `role=status` container.
- A3 Overrides removed. `.dialog-params`, `.source-test*` and the locked rule remain as documented feature residue, using tokens only (the 62/5/10px values are now `--source-test-*` tokens).
- B5-B7 `legacy-controls`, `source.css` and the `LEGACY_FILES` list are gone; all of src/ is guarded. The `legacy` map left in tokens.test.ts is the alias-value regression test, which is fine.
- B8 The SplitButton group `dataMode/dataState` is a main-button prop, read in e2e and tested. Fine.
- C9 `cssImport.test.ts` has an exact-filename regex with a self-check, the component-import rule, and the stray-CSS rule. FEATURE_CSS is an explicit allow-list with reasons (SourceDialog.css, source.css, ParamForm.css).
- C10 The alias guard takes its list from the alias block and has a self-check.
- C11 ESLint covers `ui/hooks`, `ui/*/*` and `components/source/use*`, and boundary.test has matching cases.
- C12 The icon-slot test is in CaptureControl.test.
- D13 `ensureWindowFocus` fails fast without wmctrl. D14 `.prettierignore` is correct.

Whole-009 sanity:
- Boundary: the guards cover imports, toFixed/toLocaleString and mocks.
- The tokens grep (hex/rgb in CSS outside tokens.css) is empty. `git grep toFixed|toLocaleString` in `src/ui` is empty.
- The only raw control in `src/components` (non-test) is the accepted `<button>` in `SourceButton.tsx:60`.
- No stale names left in src/e2e (legacy-controls, StatusGlyph, NumberInput, FrequencyInput, .src-dot, .mode-popover, dlg-note).
- ADR 0015 section 5 describes the `legacy-controls` layer, which no longer exists. I left the ADR unedited; the layer was transitional, as the ADR itself says. If you want a factual note, add one line, "removed in T11 (009)", under section 5.
- `src/ui/README.md` is accurate.

Notes, none blocking:
- Cancel and Forget keep native `disabled={saving}`. This is accepted, because Save shows busy.
- The after-T11 evidence has no add-ok-1024 shot, and the long-name text differs from T10's. Both are already disclosed by the developer.
- The orphan wdio runners (pids 205983 and 208169) are still alive and are not mine.

Verdict: ready for QA.
