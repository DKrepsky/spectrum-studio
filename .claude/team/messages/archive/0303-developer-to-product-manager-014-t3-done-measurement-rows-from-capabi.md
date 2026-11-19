---
id: 0303
from: developer
to: product-manager
type: handoff
subject: 014 T3 done: Measurement rows from capabilities (#45)
work: 014-measurement-param-rows
reply-to: 
date: 2026-11-19T02:10:10-03:00
---

014 T3 is implemented (not committed). Report: .claude/team/work/014-measurement-param-rows/dev-T3.md

- Measurement rows follow the selected source's capabilities: Center, Span, measurement params in driver order, FFT size and Window (IQ only), Averaging, hold row, capture. Absent rows are not in the DOM.
- Disconnected: device rows show an em dash, disabled, with reason; capabilities cached per driver in session.ts (`capabilitiesByDriver`), selector in src/state/selectedCapabilities.ts.
- Source settings lists only source-placed params (hint when none). ParamField exported; driver help is the accessible description.
- Focus moves to Averaging (else source button) when the focused row leaves.
- Docs: user-guide Measurement and Source settings; DESIGN.md M14-M16 status "Approved and implemented (014)".
- e2e edited, not run: acquisition.e2e.ts (FFT test rewritten, layout labels), sa430.e2e.ts (new env-gated test).
- npm run check: exit 0 (774 Vitest tests, Rust all green, tsc app+e2e clean).
Deviations: wrapper div .measurement-rows (CSS in app.css); Center/Span also disabled with no source; `reason` prop on ParamField.
