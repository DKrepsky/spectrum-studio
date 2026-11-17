---
id: 0210
from: developer
to: staff-engineer
type: handoff
subject: T10 source dialog done: check green, e2e 11/11 spec files green
work: 009-design-system
reply-to: 0207
date: 2026-11-16T22:38:31-03:00
---

T10 (Add/Edit source dialog) is implemented. Full `npm run check` exit 0 (cargo fmt/clippy/test, prettier, eslint, tsc, vitest 51 files / 505 tests). Full `npm run e2e` (tauri build + wdio): 11 of 11 spec files passed (main visual spec 47 passing).

Files
- src/components/source/SourceDialog.tsx: rebuilt on Dialog (title testid `dialog-title`, form testid `add-source-dialog`, initialFocus = name), DialogFooter (Forget in `start`), Field/TextField/Select, Button (Test busy, Save busy), InlineMessage notes (`dialog-note-info|warn|note`, error `dialog-error`), Spinner in the test box. No createPortal, no useFocusTrap (Dialog owns both).
- src/components/source/SourceDialog.css (new, tokens only): test row, result box variants, locked fields (`.source-locked`, 0.75), dialog param layout restore.
- src/components/source/SourceDialog.test.tsx: role/label queries kept; testids and roles updated (B2: status, no alert); new test "while saving: Save busy, Cancel unavailable, Escape does nothing"; testing asserts aria-busy/aria-disabled and Cancel enabled.
- src/ui/Field/Field.tsx: new optional `errorTestId` (the name error uses `dialog-error`).
- DELETED src/styles/sourceDialog.css; src/styles/tokens.test.ts LEGACY_FILES now app.css, source.css.
- src/styles/app.css: removed `.button-row` (only the dialog used it). src/styles/source.css: removed `.spinner` (dialog only). src/styles/source.css.test.ts: spinner assertion replaced with "no legacy spinner".
- e2e: add-source, edit-source, sa430 specs now use `dialog-title`, `dialog-error`, `dialog-note-*`. helpers.ts unchanged (PORT_INPUT still matches `.dialog-params input[type=text]`, kept).

Deviations / decisions to review
1. Busy: Test connection is `busy` (aria-disabled, focus kept, T5b overlay). Save is `busy` plus native `disabled={!canSave}` (as before): a save-in-flight Save is native-disabled, which can drop focus in WebKit; the dialog closes on success and refocuses the name on failure. Say if you want Save as `unavailable` instead (tests use toBeDisabled).
2. Dialog labels stay secondary (muted) and the param group frame is removed in the dialog. Both are restorations of the pre-T10 look (the ui stacked label is primary; ParamForm's fieldset frame is the side panel frame). Scoped overrides in SourceDialog.css, not a ui change. If you want the ui default instead, say so and it becomes a DESIGN decision.
3. Live regions (9.6 rule 1): the error and warn notes are conditionally inserted with role="status" (the spec asked for it). Only the test result box is always mounted. Insertion-with-live-attribute is the unreliable case in 9.6; if you want it strict, I can add an always-mounted polite container in the dialog.
4. Warn notes (owner, mismatch) were role=alert, now role=status (B2: no alert in the dialog).
5. Dead, not touched: app.css `.hint` and `.error` have no users in src now (out of T10 scope; for T11).
6. Git: `git rm --cached` was run once and then undone with `git restore --staged`, so the sourceDialog.css deletion is an unstaged working-tree change (` D`), like the rest of the tree.

Visual before/after (evidence/before-T10 vs after-T10; crops in evidence/compare-T10, see the PM handoff for the list)
Not captured: busy Save and save error at 1024px, and the Edit states at 1024px. The probe hit its 90 s timeout at 1024 after the FIFO release, in both the before and the after build, so both sets lack the same states. The 1180 set has all states.

Probe cleanup: e2e/specs/t10-shots.e2e.ts and its seed were deleted after the shots. Developer memory: dialog-busy-error-probes.md (invoke is not patchable; FIFO trick).
