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
