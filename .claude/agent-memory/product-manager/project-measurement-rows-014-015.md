---
name: project-measurement-rows-014-015
description: Works 014 (#45) + 015 (#46) accepted 2026-11-19 — param rows in Measurement, simulator fallback; human decisions and process lessons
metadata:
  type: project
---

2026-11-19: Frequency step + SA430 Reference level moved into Measurement (ParamSpec.placement, ADR 0018); unused rows
hidden. Human wants "always a source": simulator auto-connects at launch with no device — this REVERSED 007's "simulator
never auto-connected" (ADR 0017). Human overrode the designer's recommendation: ANY idle simulator (even user-picked)
is replaced on device plug-in. Human is emphatic: launch never starts acquisition — only the capture button does.
Failed device at launch stays Failed (no fallback). Human chose follow-up issues (#47, #48) over in-change fixes for
medium findings this time, and asked for #49 (field widths/units like Center) as a design follow-up.

**Why:** zero-empty-state startup, but the human keeps control of acquisition.
**How to apply:** keep "never auto-acquire" in every source/launch story's AC. "Fix before commit" is not absolute —
for medium, pre-existing or design-sized findings ask (fix now vs issue). Process: running 4 developers in parallel in
one checkout on disjoint files worked; e2e can't cover no-device launch with the SA430 plugged — ask the human to unplug
for one QA run (he agreed). Device tests make QA two passes (unplugged / attached). Related: [[project-auto-connect]],
[[feedback-fix-before-commit]], [[project-source-capture-013]].
