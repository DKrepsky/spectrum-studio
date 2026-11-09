---
id: 0060
from: developer
to: product-manager
type: report
subject: Finite-source contract removed; check and e2e green
work: remove-open-export
reply-to: 0059
date: 2026-11-08T22:30:26-03:00
---

The finite-source contract is removed everywhere (ADR 0011 addendum, 2026-11-08). Changes are uncommitted in the working tree.

Removed
- `Capabilities.finite` (crates/spectrum-core/src/model/source.rs). Its `finite: ...` literals are gone in spectrum-core (sources/mod.rs, sources/simulator, store.rs test, tests/session.rs, tests/probe.rs) and in spectrum-driver-sa430 (`finite: false`, allowed by the human's decision).
- `SourceData::EndOfStream` (sources/mod.rs) and its test read arm and the probe driver's read; the probe's idle read now returns a one-bin trace.
- `NoticeKind::EndOfStream` (model/session.rs) and the worker branch plus its "Reached the end of the source." notice (session/worker.rs).
- UI: NoticeBanner Restart now applies to `acquisitionFailed` only; `.notice-endOfStream` CSS removed; NoticeBanner test now uses an acquisitionFailed notice (test renamed to "offers Restart after an acquisition failure...").
- Test fixtures and mocks (src/test/fixtures.ts) and bindings: `npm run bindings` regenerated `src/bindings/Capabilities.ts` and `NoticeKind.ts`. The bindings for DriverInfo, ParamKind, SourceKind and Transport also changed; that is the other uncommitted file-removal work, not this task.
- Docs: docs/sources.md (SourceData enum), docs/architecture.md, docs/testing.md, docs/roadmap.md row wording, docs/adr/0004 (points to ADR 0011), docs/adr/0011 addendum.

Serde and persistence
- `Capabilities` is never persisted (runtime session status only). Serde ignores unknown fields by default (no deny_unknown_fields anywhere), so old payloads with `finite` still load.
- New test `model::source::tests::capabilities_ignore_the_removed_finite_key` locks this in.

Checks
- `npm run check`: exit 0. Rust fmt, clippy -D warnings, cargo test (94 + 8 + 16 + 13 + 14 + others, all passing), prettier, eslint, tsc, vitest 197/197 in 22 files. Prettier flagged NoticeBanner.tsx once; fixed with --write.
- `npm run e2e` (WebKitWebDriver extracted to the scratchpad via apt-get download, not installed): 8 of 9 specs passed on the first run. The one failure was visual.e2e.ts "the source button stays between 150 and 280px..." at the "Very long source name" step. A rerun of the visual spec alone passed 22/22, and a full rerun `npm run e2e:run` passed 9/9. I judge it a timing flake in the device-selector click path, not related to this change, but it was flaky once, so it is worth watching.
- Final grep: no `EndOfStream`, `endOfStream`, `end of stream`, `Reached the end` or `finite` references remain except the intentional ones (serde test, ADR 0011 addendum, ADR 0004 pointer, and the unrelated `is_finite` error-message assertion in params.rs).

Open concerns
- Scope note: `cargo fmt --all` ran across the whole workspace, so it may have reformatted other uncommitted files as well.
- ADR 0004's text was edited (one parenthetical) rather than left stale. Say if you want ADR 0004 left byte-identical.
