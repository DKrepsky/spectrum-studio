---
id: 0058
from: developer
to: product-manager
type: report
subject: Dead code from Open file / Export CSV removed
work: remove-open-export
reply-to: 
date: 2026-10-31T17:35:40-03:00
---

Done, uncommitted. `npm run check` is fully green (fmt, clippy -D warnings, cargo tests, prettier, eslint, tsc, vitest). `npm run e2e` not run.

Removed
- src-tauri: `export_csv` command, `ExportResult` struct, its registration in lib.rs, and the imports only it used (Serialize, AppHandle, Manager, DialogExt).
- spectrum-core `formats/csv.rs`: `write_spectrum_csv`, `CSV_FORMAT_VERSION`, `trace_column`, `window_name`, the two export tests. The reader stays.
- spectrum-core `display.rs`: `iso8601_utc` and its test (only the export used it).
- `tests/files.rs`: the export -> reload round-trip test and its unused imports.
- Frontend: the `info` state, `showInfo` and its timer in session.ts, the info banner in NoticeBanner.tsx (only export set it), the `.notice-info` CSS, and the test state reference.
- `ExportResult` had no generated binding, so `npm run bindings` changed nothing.
- Docs: roadmap row 9 now "Deferred, not supported"; removed the stale Open file / export notes in roadmap. architecture.md (diagram, security section), docs/README.md, file-formats.md (export layout dropped; CSV is "import only") and testing.md updated.
- No Cargo/package deps became unused (see below).

Kept: file-related code still live (reachable via Add source / Browse)
- `trace-csv` and `iq-file` source drivers (`sources/files.rs`), the CSV reader (`formats/csv.rs`), the SigMF/raw IQ readers (`formats/iq.rs`).
- `tauri-plugin-dialog` + `@tauri-apps/plugin-dialog` + the `dialog:allow-open` capability: the ParamForm Browse button uses them.
- `tempfile` dev-dep (still used by tests), e2e `files`/`failures` specs and recordings fixtures, docs on file sources.
- `SessionManager::latest_frame()`: no production caller now, only asserted in tests/session.rs (last frame retained after stop). Left in place; the human can decide whether to drop it.

Question for the human: drop the file source drivers and recording formats too, or keep replay?
