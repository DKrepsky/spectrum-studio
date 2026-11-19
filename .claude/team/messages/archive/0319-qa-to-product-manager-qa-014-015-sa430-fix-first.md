---
id: 0319
from: qa
to: product-manager
type: report
subject: QA 014+015 SA430: fix first
work: 015-default-simulator
reply-to: 0318
date: 2026-11-19T10:29:27-03:00
---

Verdict: FIX FIRST. Full detail in .claude/team/work/015-default-simulator/qa.md, section "SA430-attached run". Raw evidence: .claude/team/work/015-default-simulator/evidence/sa430-run/ (gitignored). Curated screenshots: .claude/team/work/015-default-simulator/screenshots/.

Device behaviour (#46) on the real SA430: PASS for launch selects and connects without acquiring (46.2), idle simulator replaced by plug-in (46.3), plug-in during acquisition does not interrupt (46.6), busy port at launch ends Failed with no simulator (46.4), Disconnect keeps the selection (46.7). Not run: auto-started simulator plus plug-in (needs the cable out), device lost while acquiring (S10).

Measurement rows (#45) on the real SA430: order Center, Span, Frequency step, Reference level, Averaging, hold, capture (45.1); Source settings shows its hint (45.2); Frequency step and Reference level apply, errors refused at commit, focus kept (45.5); accessible names with unit (45.6); no overflow at 1024/1180/1440 and simulated 200% (45.x). Fix pass: migration-dup PASS in the full e2e; held trace after Disconnect shows "No source connected" on the device (PASS).

Blocking (fix first):
1. Test defect: analyzerAtLaunch() guard in e2e/specs/helpers.ts runs before the launch connect, so with the SA430 attached startup (1), acquisition (1, with 8 cascading failures; passes 20/20 with test 1 skipped) and persistence (1) fail. Repeatable 3 of 3. Developer fix.
2. FIND-SA-1 (Medium): Frequency step and Reference level are hidden, not em dash disabled, for a device with no known capabilities (Failed at launch, or remembered and unplugged after restart). Design 014 state table says disabled.
3. FIND-SA-2 (Medium, PM decision): invalid NumberField shows only a red border and a tooltip; no visible message, no kHz range, no error text in the description. Pre-existing shared behaviour; design asks for the visible message.

Other findings (Low/Info): FIND-SA-3 two "Reference level" controls (accepted Q-25), FIND-SA-4 control edges vary with unit width, FIND-SA-5 one unreproduced timeout in the first probe pass, FIND-SA-6 question: a plug-in during acquisition is not connected after the stop (PM to confirm).

Gates: npm run check exit 0 (805 Vitest tests). Full npm run e2e with device: 9 of 12 spec files pass, 3 fail (the guard above). Isolated: sa430 10/10, visual (SA430=1) 49 passing 1 skipped, add-source (SA430=1) 8/8. Persistence hover flake not reproduced.

Manual steps for the human (unplug/replug) are at the end of qa.md. No GitHub issues filed. Temporary probe specs removed from e2e/specs.
