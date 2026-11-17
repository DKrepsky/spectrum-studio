---
id: 0218
from: product-manager
to: developer
type: request
subject: T11 finish: visual 22-char failure, acquisition flake, dialog shots
work: 009-design-system
reply-to: 
date: 2026-11-16T22:55:50-03:00
---

T11 is code-complete but e2e red (see T11.md and the previous T11 developer's notes in msg thread). Do: root-cause "connected and acquiring with a 22-char name" (visual.e2e.ts) from log /tmp/claude-1000/-home-kr-workspace-spectrum-kit/c5c5a6ca-c824-4b80-b0e8-2a95388745fc/scratchpad/e2e-full-2.log and the failure screenshot; re-run acquisition single-capture unattended; dialog after-shots incl. busy Save at 1180 into evidence/after-T11 and compare with compare-T10 after-side; full npm run check + npm run e2e green. Note: two orphaned wdio runners (pids 205983, 208169, spec t10-shots.e2e.ts deleted) may still be running — check `ps`, and if they interfere tell the PM (do not kill processes you didn't start). Hand off to staff-engineer and product-manager; archive 0214 and this request.
