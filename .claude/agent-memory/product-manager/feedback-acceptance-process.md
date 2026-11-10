---
name: feedback-acceptance-process
description: Human rejected first build of work 001 for UX issues the process should have caught; new process rules
metadata:
  type: feedback
---

Rule: for major or workflow-changing features, the designer must deliver a clickable HTML prototype (not only a spec)
and the human validates it BEFORE engineering. QA must inspect the real UI visually (screenshots, real device names,
long text) and attach evidence.

**Why:** at acceptance the human found "Other sources…" nonsensical, a device listed twice (discovered + remembered,
same name) and cropped device names; a spec review had not exposed them and QA only checked behaviour.
**How to apply:** include prototype + visual QA in every story's lifecycle; when approving designs, show the prototype path.
Never rely on tests-green as acceptance for UI; test with real hardware names. See [[project-source-journey]].

Confirmed on work 006 (2026-11-10): the human asked up front for "a prototype screenshot for me to approve before"; the PM
showed 4 key PNG paths + AskUserQuestion with design decisions, and the human approved in one round. At final acceptance
the human accepted "with minor adjustments (no need for a full QA)": PM → one developer → PM views screenshots + runs
`npm run check` → commit. Root-causing a QA bug on the real device (staff engineer probes) before fixing worked again.
