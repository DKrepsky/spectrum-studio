---
id: 0008
from: staff-engineer
to: product-manager
type: handoff
subject: Plan updated per PM decisions
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:19:13-03:00
---

Done. Edited only plan.md (sections 3, 8, 10) and tasks T4.md, T5.md; T1-T3 untouched.
- Other sources deviation removed; design followed exactly. source-other-<driverId> id dropped.
- e2e harness: wdio.conf.ts already isolates XDG_CONFIG_HOME per spec worker (app dir io.github.spectrumstudio) but cannot seed. T5 adds seeding from e2e/fixtures/seed/<spec-basename>/ (with {{REPO}} templating) copied on first dir creation. Seeded v2 entries (simulator failConnect, file with bad/real path) drive failures/files specs; v1 seed in new migration.e2e.ts.
- Run re-remember kept; SA430 stable-device-id limitation goes in roadmap via T5.
- Note: fault injection via the form is now only Vitest-covered; T5 depends on T1 final v2 schema for fixtures.
