# ADR 0006 — Local JSON files for preferences and saved sources

Status: accepted (2026-10-25); the saved-source model is amended by [ADR 0009](0009-automatic-source-memory.md) and
[ADR 0010](0010-stable-device-identity.md)

## Context

Preferences and saved source configurations must survive restarts. The app is local-first and
single-user.

## Options

- `tauri-plugin-store`: convenient, but stores untyped JSON and moves validation to the UI.
- SQLite: robust, but unnecessary for two small documents.
- **Own typed JSON files** in the Rust core: typed with serde, validated, testable without Tauri.

## Decision

`store::ConfigStore` keeps `preferences.json` and `sources.json` in the platform config directory
(`$XDG_CONFIG_HOME/io.github.spectrumstudio`). Each file has a `version`, uses `serde(default)` for
forward compatibility, and is validated on load and before every save. Writes are atomic (temp file
+ rename). Invalid files are renamed to `*.corrupt-<timestamp>.json`, defaults are used and a
warning is shown once.

The backend persists processing settings and the last selected source when they change; the UI
saves display preferences with a short debounce. The last source is restored as the selection but
never connected automatically (hardware should not start transmitting/streaming unexpectedly).

## Consequences

- No extra dependency; corruption never prevents start-up.
- Schema changes need a version bump and a migration in `store.rs` if fields change meaning.

## Amendment (2026-10-31): migrations that rewrite
Schema changes that merge or re-key entries (`sources.json` v3, [ADR 0010](0010-stable-device-identity.md))
run when the file is loaded. Before the first rewrite the previous file is copied to
`sources.pre-v<version>-<timestamp>.json` and the new one is written atomically; a failed backup or
write is logged and reported as a warning, the in-memory result is used, and the rewrite is retried
on the next write. Files with a *newer* version than the app knows are neither migrated nor rewritten
on load.
