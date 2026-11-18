---
name: project-source-capture-013
description: Work 013 (#40) moved source button + capture control into the Measurement group; toolbar brand-only; capture not sticky
metadata:
  type: project
---

2026-11-18: device selector first and capture control last in the side panel Measurement group; toolbar = brand only.
Human chose to leave the capture control non-sticky (it scrolls out of view with Source settings open) and again chose
"fix all, then commit" for small QA findings incl. pre-existing ones ([[feedback-fix-before-commit]]); on the second
round of low leftovers (N1/N2/N4) chose "accept and commit" with follow-up issues #41–#43.

**Why:** the human wants a top-to-bottom Measurement flow (source → settings → capture) and stops the fix loop after one pass.
**How to apply:** one fix pass for small findings, then offer accept+issues. Before committing, keep raw e2e screenshot
sets in the work folder's gitignored `evidence/` (QA put 13 MB in screenshots/e2e-raw; I had to amend). Developers may
hand back while e2e still runs: read the log in the PM scratchpad yourself rather than re-dispatching. Build e2e into a
separate CARGO_TARGET_DIR when a dev instance owns target/debug. Related: [[project-measurement-012]].
