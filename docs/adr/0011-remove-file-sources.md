# ADR 0011 — File sources and CSV export are removed

Status: accepted (2026-10-31). Supersedes the file parts of ADR 0002, 0003, 0004 and 0008.

## Context

Spectrum Studio read IQ recordings (SigMF, raw cf32/cs16/cu8/cs8) and CSV spectrum traces as
sources, and could export the displayed spectrum to CSV. Those features were built before the
hardware drivers and the source menu settled, and they now carry cost without a current user need:
a `path` parameter kind with a native file dialog, a `formats` module with its own parsers, the
`SourceKind::File` and `Transport::File` variants, the latest-frame slot kept only for export, and
the end-to-end fixtures and tests that exercise them. The product owner decided to drop all file
functionality for now.

## Decision

- The `iq-file` and `trace-csv` drivers, the `formats` module, the CSV export and the file dialog
  are removed. So are `ParamKind::Path`, `SourceKind::File`, `Transport::File`,
  `SessionManager::latest_frame` and the `dialog` plugin with its capability.
- Remembered sources of removed drivers are not migrated or deleted. They load, stay in
  `sources.json` untouched and are hidden from the UI and from `connectable`, like unknown drivers.
- Simulator and SA430 behaviour, the `Planned` driver mechanism and the generic source contract are
  unchanged.

## Addendum (2026-11-08): finite-source contract removed

With no file source left, the contract kept above for them is removed too:
`Capabilities.finite`, `SourceData::EndOfStream`, `NoticeKind::EndOfStream` and the session worker
branch that stopped acquisition on end of stream, together with the "Reached the end of the source."
notice, the UI styling and tests. The SA430 and simulator no longer set `finite`. The removal is
additive-safe for stored data: `Capabilities` is never persisted (it lives in the runtime session
status), and serde ignores unknown fields by default, so a payload that still carries `finite` or
`endOfStream` deserializes without error. The `read` contract is now `Iq` or `Trace`, and a read
error is the only way acquisition ends on its own.

## Consequences

- No offline replay: all acquisition needs a connected device or the simulator.
- Re-introducing recordings or export needs a new ADR; the removed code is in git history before
  this change.
- Earlier ADRs keep their text. Where they describe the file features, they carry a pointer here.
