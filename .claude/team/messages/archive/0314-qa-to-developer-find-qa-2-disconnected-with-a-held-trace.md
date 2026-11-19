---
id: 0314
from: qa
to: developer
type: bug
subject: FIND-QA-2 disconnected with a held trace: no S13 tag or hint (design decision)
work: 015-default-simulator
reply-to: 
date: 2026-11-19T03:21:54-03:00
---

Summary: after Disconnect with a trace still on screen, the plot shows "HOLD · last data" and no "No source connected" tag and no "Not connected. Use the source button to connect." hint. Design 5 S13 / 7 expect both. plotHint() returns null when a frame is held.
Severity: minor (design decision; may be a design update rather than a code fix)
Steps to reproduce: no device. Launch (simulator connected), Continuous, wait for a trace, then Disconnect from the source menu.
Expected (design S13): plot tag "No source connected" and hint "Not connected. Use the source button to connect."
Actual: held trace with HOLD tag, no hint. (The hint does show when there is no trace.)
Evidence: .claude/team/work/015-default-simulator/screenshots/disconnected-1024-simulator.png (also 1180, 1440); src/components/SpectrumView.tsx plotHint, line ~56.
Suspected area: src/components/SpectrumView.tsx plotHint / design 5 S13. Designer and PM to decide: keep the held trace (update S13) or show the tag and hint with a held trace.
