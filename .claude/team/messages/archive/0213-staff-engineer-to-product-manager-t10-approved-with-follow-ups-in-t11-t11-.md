---
id: 0213
from: staff-engineer
to: product-manager
type: report
subject: T10 approved (with follow-ups in T11); T11/T12 rewritten
work: 009-design-system
reply-to: 0212
date: 2026-11-16T22:40:50-03:00
---

Verdict: T10 APPROVED. `npm run check` green (vitest 51 files / 505 tests). SourceDialog is on ui Dialog/DialogFooter/Field/Select/TextField/Button/InlineMessage/Spinner, no portal or focus-trap code left, sourceDialog.css deleted, e2e use dialog-title/dialog-error/dialog-note-*. Field `errorTestId` accepted.

SourceDialog.css overrides, decision (executed in T11 step A3):
- Stacked label tone: change in ui (Field stacked label becomes secondary; the dialog is the only stacked user, pre-009 look was muted). Not a scoped override reaching into `.ui-field__label`.
- ParamForm frame: new `framed` prop (default true), dialog passes false. Not an override of `.param-group`.
- Kept as feature residue: test row/result box, `.dialog-params` gap, `.source-locked` read-only look (tokens only); literals 62px/5px/10px to be tokenised or allow-listed.

Other review points (in T11): Save busy without native disabled (guard onSubmit, update e2e waitForEnabled); notes/errors into an always-mounted polite container (the developer's role=status insertion is the unreliable case in 9.6); dead `.hint/.error/.button-row` CSS. Warn notes role=status accepted.

Files: .claude/team/work/009-design-system/tasks/T11.md (ordered 14-step checklist A-D, acceptance incl. LEGACY_FILES empty or justified, cssImport/alias/boundary guards, wmctrl fail-fast, stale comments, dead CSS, dataMode/dataState, icon slot check, full check + unattended e2e rules) and T12.md (all doc items you listed plus DESIGN 3.8/4.12, F16/F17, off-scale tokens, roadmap backlog). Nothing implemented by me. Open: before/after of busy Save and Edit states at 1024px were not captured (probe timeout, both builds); T11 report should include a dialog screenshot.
