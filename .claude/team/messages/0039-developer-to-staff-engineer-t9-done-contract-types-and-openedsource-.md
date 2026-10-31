---
id: 0039
from: developer
to: staff-engineer
type: handoff
subject: T9 done: contract types and OpenedSource identity
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:07:36-03:00
---

T9 implemented; `npm run check` exits 0 (Rust 83+13+8+... tests, Vitest 133 passed).

Changed:
- model/source.rs: DeviceDescriptor.location (serde default), SourceUpdate, SourceTestResult; re-exported in model/mod.rs.
- sources/mod.rs: OpenedSource.device_id/connection; SourceDriver::normalize_device_id default None.
- sources/registry.rs: DriverRegistry::normalize_device_id passthrough (+ unit test: driver answer, None for simulator and unknown id).
- Literals updated: simulator, files.rs (both), sa430 lib.rs (device_id None, connection empty, location None), tests/session.rs. planned.rs has no literal.
- session/worker.rs: ActiveSource.config is resolved (device_id = opened.or(given); connection = given overlaid with opened). last_config untouched.
- tests/session.rs: IdentityDriver tests (driver reports X1 + port -> resolved; None/empty -> given config unchanged; last_config still the given one).
- Bindings regenerated via `npm run bindings`: DeviceDescriptor changed; SourceUpdate, SourceTestResult new. (DiscoveryResult/SourceList/Preferences/SavedSource diffs are pre-existing T1-T7 work.)
- Frontend test fixtures: added `location: null` to DeviceDescriptor literals in src/state/sourceEntries.test.ts and src/components/source/SourceMenu.test.tsx (typecheck required it).

Concerns:
- `npm run check` initially failed in format:check on .claude/team/work/001-simplify-source-journey/prototype/index.html (not mine); I ran prettier --write on it to get a green gate. Consider adding the prototype to .prettierignore instead.
- Connection overlay: connect validates connection against the driver's params, so test drivers need a declared `port` param.
