---
id: 0315
from: qa
to: product-manager
type: report
subject: QA 014+015 no-device: fix first
work: 015-default-simulator
reply-to: 
date: 2026-11-19T03:21:54-03:00
---

Verdict: FIX FIRST (not ready to commit). Full report: .claude/team/work/015-default-simulator/qa.md

No device (SA430 unplugged).

Gates: npm run check exit 0 (cargo 250 passed; Vitest 803 passed). npm run e2e: 111 passed, 1 failed (migration-dup), SA430 tests skipped. Visual spec: 47/47 in the full run and in 2 reruns.

#46 (no device): PASS for launch simulator connected not acquiring (e2e + probe, screenshot), "Loading…" before the first status (probe: "Source: Loading…" then "Connected", closes #3), disconnect keeps selection, forget selected -> simulator (e2e), fixed menu row (screenshot). NOT RUN (SA430 needed): device at launch, plug-in replaces idle simulator, failed device no fallback, plug-in during acquisition.

#45 (simulator): PASS for rows Center, Span, FFT size, Window, Averaging, hold, capture; no Frequency step / Reference level; disabled-while-disconnected; Tab order = visual order; focus ring visible; commit keeps focus; 200% (simulated zoom) OK at 1024 and 1180; 1024/1180/1440 screenshots OK. SA430 rows: NOT RUN for the real device; injected-DOM check shows the label column fits ("Frequency step" 165 px column).

Findings:
- BUG-QA-1 (major, blocks commit): migration-dup e2e expects one record; the launch fallback remembers an unnamed simulator record. Test expectation is stale; migration is correct. Sent to developer, cc staff-engineer.
- FIND-QA-2 (minor, design decision): after Disconnect with a held trace, no "No source connected" tag or "Not connected" hint (S13). Sent to developer for the decision.
- FIND-QA-3 (low, PM): AC #45 says "Freq. step", shipped "Frequency step" (design Q-24). Align the AC or the label.
- FIND-QA-5 (info): visual hover "did not settle" did not reproduce in 3 of 3 visual runs. Not a regression seen; HEAD not built.

Residual risk: the hardware paths (plug/unplug timing, busy port, real Frequency step / Reference level applies) are unit-tested and listed as the second-run checklist in qa.md.
