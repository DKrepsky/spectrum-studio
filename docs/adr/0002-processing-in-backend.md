# ADR 0002 — Spectrum processing runs in the Rust backend

> **Update (2026-10-31):** file sources and CSV export were removed; see [ADR 0011](0011-remove-file-sources.md). The text below is kept as it was written.

Status: accepted (2026-10-25)

## Context

Averaging, hold traces and peak search could run in the UI or in the backend.

## Decision

The backend computes the complete frame: spectrum, averaged trace, max/min hold and detected
peaks. The UI only draws and handles interaction (zoom, markers).

## Rationale

- One implementation for IQ sources and trace sources, covered by Rust numerical tests.
- CSV export writes exactly the data that produced the display, including holds.
- Raw IQ never crosses IPC (2+ MSps would overload it); only per-frame bins do.

## Consequences

- Processing settings changes are commands to the worker; frames carry the settings that produced
  them.
- Marker readouts are computed in the UI from the latest frame (cheap lookups/interpolation).
