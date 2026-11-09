---
id: 0057
from: developer
to: product-manager
type: report
subject: Open file and Export CSV removed from UI
work: remove-open-export
reply-to: 
date: 2026-10-31T17:29:23-03:00
---

Done (uncommitted). Removed "Open file…" from the source menu: openFile handler, menu item, fileDrivers memo, dead fileDriverFor() + its test, unused imports (dialog, errorMessage, visibleDrivers). ParamForm still uses plugin-dialog for the path "Browse" field, so the plugin stays. SourceDialog copy is now "The file cannot be changed." (test updated). SourceMenu tests: removed the Open file describe and two assertions. e2e add-source/files comments updated.
Export UI WAS present: toolbar "Export CSV" button (Toolbar.tsx, App.tsx onExport), session.exportCsv, api.exportCsv/ExportResult, mockApi, Toolbar test, visual.e2e chrome-fit assertions, .toolbar-end CSS. All removed. Backend Rust (export_csv command, CSV writer) left untouched; it is now unreachable from the UI (the Tauri export_csv command is dead code on the UI side; staff-engineer may want to drop it).
Docs: user-guide (Open file + Export CSV rows), README Export bullet, testing.md note. NOT changed: docs/roadmap.md row 9 ("Export CSV: Done") and docs/architecture.md/file-formats.md mention export, those are your call.
npm run check: all green (fmt, clippy, cargo tests, prettier, eslint, tsc, vitest 198 passed). npm run e2e not run.
