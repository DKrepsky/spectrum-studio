# ADR 0018 — Measurement rows come from a placement on each parameter

Status: accepted (2026-11-19, work 014, issue #45)

## Context

Work 014 moves the SA430's Frequency step and Reference level from Source settings into the
Measurement group and hides rows a source does not use. The UI must not know which device has which
setting (CLAUDE.md, `docs/sources.md`); it already renders runtime settings generically from
`Capabilities.params`.

## Decision

- **`ParamSpec.placement: ParamPlacement`** (`measurement` | `source`, serde default `source`,
  camelCase). A driver marks the runtime settings that belong with Center and Span in Measurement with
  `ParamSpec::in_measurement()`. Everything else stays in Source settings. Connection parameters
  ignore it. The `group` field is unrelated: it is a heading inside a form, not a section.
- **Measurement rows follow data kind and placement, never a driver id.** Order: Center, Span, the
  `measurement` params in the order the driver lists them, then (for `DataKind::Iq`) FFT size and
  Window, then Averaging, the hold row and the capture control. A row that does not apply is not
  rendered (not disabled). FFT size and Window are processing settings of the application and apply
  to `Iq` only.
- **Which rows while disconnected.** The UI keeps the last `Capabilities` reported by each driver for
  the run (`useSession`, keyed by `driverId`) and uses the selected source's entry when no source is
  open. The device rows then show `—` and are disabled. A source never opened in this run (for
  example a device that failed at launch) has none: the rows Center, Span, Averaging, hold row and
  capture control show. No new IPC and no persistence.
- **One field component for both places.** `ParamField` (today private to `ParamForm.tsx`) is
  exported; Source settings and Measurement render a param through it, so validation, commit, error
  and focus behaviour are identical.

## Alternatives rejected

- **Reuse `group` as the placement** ("Measurement" group name): overloads a heading and makes a typo
  silently move a setting.
- **The UI choosing rows by `driverId` or `SourceKind`:** forbidden by the device-agnostic rule.
- **Backend-reported "last known capabilities":** a status field and cache for a case (rows of a
  source that was never opened this run) that cannot be answered anyway; the UI cache costs nothing
  and survives only the run, which the design accepts. Persisting kind across launches is a possible
  follow-up (static runtime specs on `DriverInfo`).
- **A per-row `visible` flag on the spec:** hiding is derived (kind and placement), not stored.

## Consequences

- `ParamSpec` changes: run `npm run bindings`; Rust code that builds a `ParamSpec` literal adds the
  field (or uses the constructors).
- A new driver gets the layout for free by marking its settings.
