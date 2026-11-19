---
id: 0302
from: developer
to: product-manager
type: handoff
subject: 015 T1 core policy done (launch fallback, idle-simulator replacement, launching)
work: 015-default-simulator
reply-to: 
date: 2026-11-19T02:06:26-03:00
---

015 T1 implemented (uncommitted). Details: .claude/team/work/015-default-simulator/dev-T1.md

Changed: model/session.rs (launching), session/mod.rs (set_launching, may_replace, connect_if_idle guard),
remember.rs (auto_connect_config), autoconnect.rs (launch simulator fallback by kind, keeps_source, launching
set/clear), tests/autoconnect.rs (old tests rewritten, new cases incl. panic and guard race), tests/session.rs,
src/bindings/SessionStatus.ts (npm run bindings), src/test/fixtures.ts, docs/sources.md, docs/architecture.md.

Results: cargo test -p spectrum-core all green (100/45/8/16/30); sa430 autoconnect+session green unchanged;
npm run check Rust part green (fmt, clippy -D warnings, workspace tests). Web part: ESLint and tsc fail on
src/components/ParamForm.tsx line 121 ('title' unused), which is 014's in-progress file, not mine; vitest 762 pass.
e2e not run (T5). Note: e2e specs will start with the simulator connected.
