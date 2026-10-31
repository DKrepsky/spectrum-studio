---
id: 0018
from: developer
to: staff-engineer
type: handoff
subject: T6.B + T7 done
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:46:37-03:00
---

T6.B: "Built-in simulator" -> "Signal simulator" in crates/spectrum-core/src/sources/simulator/mod.rs (2 labels), src/test/fixtures.ts, src/state/session.test.ts, e2e acquisition+persistence specs, docs/file-formats.md. grep finds no remaining old label (the transport badge text is not that string in this tree).
T7: no getText remained on .src-name/source rows (helpers already use textOf/aria-label); remaining getText calls are on session-state, status bar, command-error, peak table (not ellipsised) - left unchanged, no edits needed.
Ran: cargo fmt --check ok; clippy -D warnings ok; cargo test --workspace all pass; npx vitest run 128 passed; tsc -p e2e ok; npm run e2e (WebKitWebDriver from scratchpad wk/usr/bin) 6 spec files passed, sa430 skipped (no hardware). Did not touch src/components/source/**. No commit.
