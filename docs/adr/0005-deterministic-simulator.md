# ADR 0005 — Deterministic simulator with its own PRNG

Status: accepted (2026-10-25)

## Context

The simulator must produce repeatable signals so tests and bug reports are reproducible.

## Decision

- The simulator uses an in-crate xoshiro256++ generator seeded by SplitMix64 and Box–Muller
  Gaussian noise. The algorithms are fixed and documented, so output is bit-identical across
  versions and platforms, independent of third-party RNG crates changing their streams.
- Simulated time is derived from the block counter (`t = n · hop`), not the wall clock; pacing to
  real time is a separate sleep. The same seed and settings always produce the same samples.

## Consequences

- One less dependency; ~40 lines of well-known code with tests.
- Frames are labelled `simulated: true` and the UI shows a persistent SIMULATED badge.
