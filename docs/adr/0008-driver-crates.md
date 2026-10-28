# ADR 0008: Hardware drivers live in their own crates

## Status
Accepted

## Context
`spectrum-core` depended on the `sa430` crate and hard-coded every driver in
`DriverRegistry::with_builtin_drivers`. Each new device would have added a dependency to the domain
crate and an edit to its registry, contradicting the rule that hardware specifics stay in a driver.

## Decision
Each hardware driver is a crate `crates/spectrum-driver-<name>` depending on `spectrum-core` (never
the reverse). `spectrum-core` keeps the traits, the simulator, file readers and planned entries
(`DriverRegistry::with_core_drivers`). The application (`src-tauri`) is the composition root and
registers hardware drivers.

## Consequences
- Core builds and tests without any device library; the dependency direction is enforced by Cargo.
- Adding a device touches only its crate plus one line in `driver_registry()`.
- Driver tests use only the public core API.

## Addendum: bindings feature
`ts-rs` is an optional dependency of `spectrum-core`, enabled by the `bindings` feature. The domain
crate no longer depends on a frontend tool at runtime; `npm run bindings` builds with the feature
enabled to regenerate `src/bindings`.

## Addendum: structured source errors
`SourceError` was an enum of `String`s, which lost the underlying error and forced `Clone +
PartialEq`. It is now a struct with a `SourceErrorKind` (`non_exhaustive`), the user-facing message
and an optional boxed cause, exposed through `Error::source()`. Callers match on `kind()`.
`SessionError` is no longer `Clone`/`PartialEq` as a consequence.
