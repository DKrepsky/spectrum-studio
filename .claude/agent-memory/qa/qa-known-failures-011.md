---
name: qa-known-failures-011
description: Pre-existing deterministic failures seen in the full e2e run during work 011 (acquisition.e2e.ts two tests), present at HEAD too; check before blaming a change
metadata:
  type: project
---

- `e2e/specs/acquisition.e2e.ts`: "pauses: the last trace stays on screen, frozen and marked as held" reads the `plot-liveness` testid as "" although the HOLD badge is visible in the screenshot; "a single capture takes exactly one sweep and stops by itself" times out on the frame count. Seen on HEAD (git archive build) and on the working tree, alone and in the full run, on 2026-11-17. Reported as BUG-011-QA-1 to product-manager (cc staff-engineer), work 011.
- **Why:** it makes `npm run e2e` red on every run, so a real regression elsewhere would be hidden in the noise.
- **How to apply:** before blaming a change for an acquisition e2e failure, rerun the spec against a HEAD build. If the bug is still open, the failure is pre-existing.

Related: [[reconnect-failed-then-plugin-recipe]]
