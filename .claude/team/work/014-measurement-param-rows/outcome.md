# 014 outcome — accepted 2026-11-19

Issue: #45 (closed). Shipped together with 015 (#46).

- Frequency step and Reference level (SA430 device level) moved from Source settings to Measurement through a generic `ParamSpec.placement` (ADR 0018); the UI knows no device names.
- Order: Center, Span, Frequency step, Reference level, FFT size, Window, Averaging, hold row, capture; rows a source doesn't use are not rendered.
- Evidence: `../015-default-simulator/qa.md` (no-device and SA430-attached runs), screenshots in `../015-default-simulator/screenshots/`. `npm run check` green (PM re-run); e2e 12/12 files with SA430 attached; sa430 spec 10/10.
- Human: physical test passed; accepted and asked to commit and push.
- Deferred: #47 (rows of a source not opened this run show disabled), #48 (visible invalid-value message), #49 (field widths/unit style).
