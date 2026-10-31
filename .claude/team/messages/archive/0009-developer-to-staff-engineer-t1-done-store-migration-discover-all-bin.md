---
id: 0009
from: developer
to: staff-engineer
type: handoff
subject: T1 done: store, migration, discover_all, bindings
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:22:08-03:00
---

T1 implemented (uncommitted, main worktree).
Files: crates/spectrum-core/src/store.rs (+tests), model/source.rs (DiscoveryResult), model/mod.rs, session/mod.rs, tests/session.rs; bindings regenerated (Preferences, SavedSource changed; SourceList, DiscoveryResult new).
Store API: sources_all, source_list(&[DriverInfo]) -> SourceList, free fn connectable(), remember_connected(id, &ActiveSource, driver_available), update_source_settings, rename_source (->SavedSource), forget_source (->SavedSource), restore_source(SavedSource) -> Result<()>, set_last_source_id(Option<&str>). save_source/delete_source/saved_sources removed. These return SavedSource / () (not SourceList); T2 should build the SourceList via source_list(drivers).
Extra (not in task, in session/mod.rs): SessionManager::connect_with_default_fallback(config) implements the stale-settings retry (InvalidSettings + non-empty settings -> retry once with cleared settings) so T2 can use it instead of writing the logic in src-tauri. discover_all(): available + supports_discovery + transport not Internal/File, per-driver error captured, internal scan mutex, never takes the worker lock.
Behaviour notes: SOURCES_SCHEMA_VERSION=2 (prefs stays SCHEMA_VERSION=1). v1 load never rewrites; last_used_ms=updated_ms, names >80 truncated in memory, empty names valid. lastSource migration is in-memory at open (reuses the most recently used identity match or creates an entry); it is persisted by the next write, and update_preferences first flushes sources if a migration created an entry. remember_connected does NOT set last_source_id; commands call set_last_source_id. When at the 200 cap with nothing evictable it returns Err (caller logs warn).
SA430 discover finding: Sa430Driver::discover -> SerialPortScanner::scan -> serialport::available_ports() filtered by USB VID/PID; enumeration only, never opens a port. Safe while acquiring (real-device check remains QA).
Tests: 16 store unit tests (v1 fixture with named/ghost/soapysdr entries surviving rewrites, migration both ways, upsert/duplicates/by-id, cap eviction, settings write-back, rename/forget/restore, failed write) + 4 session tests (discover_all filtering/error isolation, discover during acquisition, switch/failed connect, stale-settings fallback).
Results: cargo fmt --check OK; cargo clippy -p spectrum-core --all-targets -D warnings OK; cargo test -p spectrum-core all green (82 lib + 11 session + files); sa430 crate tests green.
Broken until other tasks: src-tauri does not compile (commands.rs uses saved_sources/save_source/delete_source and Preferences.last_source) -> T2. Frontend: bindings SavedSource now has label/lastUsedMs and Preferences has lastSourceId, so code/mocks constructing SavedSource/Preferences literals need those fields -> T3 (npm run check not run for that reason).
