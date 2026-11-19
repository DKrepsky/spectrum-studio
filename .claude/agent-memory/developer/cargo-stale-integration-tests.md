---
name: cargo-stale-integration-tests
description: With several agents editing spectrum-core at once, integration tests can report bogus "no field" errors that vanish after touching src/lib.rs
metadata:
  type: feedback
---

When other agents edit `crates/spectrum-core` concurrently, `cargo test -p spectrum-core --test X`
can fail with errors such as "struct ParamSpec has no field named placement" even though the lib
source and `--lib` tests are correct.

**Why:** observed during work 014 T1; cargo's incremental state was stale from a concurrent edit.
`touch crates/spectrum-core/src/lib.rs` forced a rebuild and the same targets passed.

**How to apply:** if an integration target fails on a field or type you can see in the source, touch
the crate's `lib.rs` and retry before debugging the code. Do not wait with `sleep` (blocked by the
harness); retry directly.
