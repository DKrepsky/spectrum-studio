---
id: 0250
from: qa
to: developer
type: bug
subject: Dialog stories show a 'Source' legend the app does not render (D3)
work: 010-storybook
reply-to: 
date: 2026-11-17T01:42:26-03:00
---

Summary: every Dialog story wraps fields in FieldGroup legend="Source"; the app's SourceDialog and SourceForm render no such legend, so the stories show UI the app does not have.
Severity: minor (story only)
Steps to reproduce: Storybook UI/Dialog > Idle or Saving.
Expected: story fields match SourceDialog (Name field directly under the title, no 'Source' line).
Actual: a 'Source' line sits above 'Name'.
Evidence: .claude/team/work/010-storybook/screenshots/sb-dialog-saving-720-stub.png, .claude/team/work/010-storybook/screenshots/sheets/sheet-UI_Dialog.png
Suspected area: src/ui/Dialog/Dialog.stories.tsx (all stories using FieldGroup legend=Source).
