---
id: 0059
from: developer
to: product-manager
type: report
subject: File functionality removed: IQ/CSV sources, formats, file dialog, tests, e2e, docs
work: remove-open-export
reply-to: 0058
date: 2026-10-31T17:50:04-03:00
---

Done, uncommitted, working tree only. Everything file-related is gone except the deliberate keeps listed below.

REMOVED
- Rust core: `sources/files.rs` (trace-csv, iq-file drivers), `formats/` (csv, iq, mod), registry entries, `tests/files.rs`; `SourceKind::File`, `Transport::File`; `ParamKind::Path` + `ParamSpec::path`; `SessionManager::latest_frame()`; store `File` arms and the file-only tests (the simulator rename test is rewritten); `discover_all` filter now `!= Internal`.
- Tauri shell: `tauri-plugin-dialog` (Cargo, `.plugin(...)` init), `dialog:allow-open` capability, `tempfile` dev-dep (kept in spectrum-core, used by store/remember tests). Cargo.lock drops the dialog tree (rfd, tauri-plugin-fs, ...). Bundle descriptions no longer mention recordings.
- npm: `@tauri-apps/plugin-dialog` (package.json + lock).
- Frontend: ParamForm Browse/path case; SourceDialog read-only File field; SourceMenu recording-path detail; sourceEntries file label, path basename, file dialog filter; `.path-field`/`.ro` CSS; mock dialog and file checks; `fileDriver` fixture; tests updated (SourceDialog, SourceMenu, sourceEntries, session, NoticeBanner).
- Copy: end-of-stream notice "Reached the end of the recording." -> "Reached the end of the source."
- Bindings regenerated (`npm run bindings`): Transport, SourceKind, ParamKind, plus doc-comment updates in DriverInfo and Capabilities.
- e2e: `specs/files.e2e.ts`, `fixtures/recordings/`, `fixtures/seed/files/`; failures spec: the two file cases and `commandError` helper; edit-source: read-only recording test (its seed is now a second simulator preset "Spare simulator"); migration: `old-trace` (trace-csv) is now asserted hidden, like the ghost entry; screenshot seed: doc-iq and doc-csv removed.
- Docs: `docs/file-formats.md` deleted; README (features, docs table), docs/README, architecture, sources, testing, user-guide (Recordings section, badge list), roadmap (rows 9, recordings, failures, limitation, next step 6 annotated), dsp; CLAUDE.md repo-map line; `.claude/skills/add-source-integration/SKILL.md` (file-format wording). ADRs 0002, 0003, 0004, 0008, 0010 carry a one-line update pointer, text unchanged. NEW `docs/adr/0011-remove-file-sources.md` (accepted, 2026-10-31) records the decision.
- `docs/images/source-menu.png` regenerated with `npm run docs:screenshot` (checked: no recordings). main-window.png and edit-source.png were regenerated too but had no content change, so I restored them.

NEW TEST
- `crates/spectrum-core/tests/remember.rs::entries_of_removed_drivers_stay_hidden_and_survive_a_rewrite`: loads a v3 file with trace-csv and iq-file entries; no warnings; not in `connectable`; `normalize_device_id` returns None; a normal connect rewrites the file and the old entries survive, still hidden. The e2e migration spec covers the same at UI level.

KEPT, AND WHY
- `Capabilities.finite`, `SourceData::EndOfStream`, `NoticeKind::EndOfStream` and its worker branch: part of the generic source contract. The SA430 sets `finite: false`, and "SA430 untouched" rules out removing that field. No driver produces end of stream now. Decide separately whether to remove them.
- Planned-driver mechanism, simulator, SA430: untouched.
- `tempfile` in spectrum-core dev-deps: still used.
- Generic "file" wording in ADR 0006/0009 and guidelines.md: not file features, left alone.

DEVIATIONS
- Visual guard (`visual.e2e.ts`): the seeded `vis-file` row is replaced by an SA430 with a long serial-port path, so the six-row and long line-2 coverage stays. The badge-kind check drops from >=3 to >=2 (USB and Built-in are all that remain). Badge width and alignment checks are unchanged.
- Session test: the "old frames are discarded on switch" assertion (it used `latest_frame`) is now a `wait_frame` check that no frame arrives while the new source is connected but not started.

CHECKS
- `npm run check`: exit 0. cargo fmt, clippy -D warnings, cargo test --workspace (spectrum-core lib 93, probe 8, remember 16 incl. the new test, session 13; sa430 14 + 8, 3 hardware tests ignored), Prettier, ESLint, tsc (app and e2e), Vitest 197/197 in 22 files.
- `npm run e2e`: run 1 had 7/9 passing. The two failures were from my seed edits (a duplicate simulator identity blocked the rename; the badge-kind count). Fixed, then run 2: 9/9 passed (`PASSED` on every spec, incl. visual guard). WebKitWebDriver was not installed system-wide; I extracted it with `apt-get download webkit2gtk-driver` into the scratchpad and put it on PATH for the run. Nothing installed.

OPEN CONCERNS
- Please review ADR 0011 wording.
- Whether to remove `finite`/`EndOfStream` (needs a decision because of the SA430 field).
- Staged state: none. Nothing committed. Other uncommitted work (e.g. `add-source.e2e.ts`, `src-tauri/src/commands.rs`, `src/App.tsx`) was already in the tree and I did not touch it beyond my edits.
