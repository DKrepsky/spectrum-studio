# ADR 0004 — Driver/Source traits with declared capabilities

> **Update (2026-10-31):** file sources and CSV export were removed; see [ADR 0011](0011-remove-file-sources.md). The text below is kept as it was written.

Status: accepted (2026-10-25)

## Context

SDRs stream IQ and can tune; spectrum analyzers return measured traces in calibrated units; files
are finite and fixed; the simulator is synthetic. Forcing one feature set on all of them would
produce fake controls.

## Decision

- `SourceDriver` — one per integration type: metadata (kind, transport, implementation status),
  optional discovery, parameter specs, `open(config)`.
- `Source` — an opened connection: `capabilities()`, `apply(settings)`, `start()`, `read()`,
  `stop()`; `read` yields `SourceData::Iq` or `SourceData::Trace` (the end-of-stream variant was removed, see
  ADR 0011).
- `Capabilities` declares what can be controlled (tuning range, sample rates, amplitude unit, data
  kind). Device-specific settings are described with generic `ParamSpec`s
  (number/enum/bool/text with ranges and units) and rendered by a generic form in the UI.

Integrations that are not implemented are registered with `DriverStatus::Planned` so the UI can
list them honestly as unavailable.

## Consequences

- Adding hardware is local to `sources/`; the session, DSP and UI stay untouched.
- Sources are synchronous and run on the session worker thread; drivers must bound `read` latency.
