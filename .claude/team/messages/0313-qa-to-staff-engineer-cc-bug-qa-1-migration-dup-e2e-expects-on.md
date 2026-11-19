---
id: 0313
from: qa
to: staff-engineer
type: bug
subject: cc: BUG-QA-1 migration-dup e2e expects one record, finds two
work: 015-default-simulator
reply-to: 
date: 2026-11-19T03:21:44-03:00
---

Summary: migration-dup.e2e.ts "wrote version 3 with one record and left a backup" fails: sources.json has 2 records, the spec expects 1. Test expectation is stale (ADR 0017 launch fallback remembers an unnamed simulator record). The migration itself is correct. Not a product regression; fix the spec.
Severity: major (blocks `npm run e2e` green and therefore the commit)
Steps to reproduce: SA430 unplugged. `npm run e2e:run -- --spec e2e/specs/migration-dup.e2e.ts` (after build), or the full run.
Expected: the spec counts device records (or accepts the unnamed simulator record that the no-device launch remembers) and passes.
Actual: `Expected length: 1, Received length: 2`. Second record: driverId simulator, deviceId null, name "", label "Signal simulator", created at launch (id src-1a1f26ebd14). The SA430 record is the merged one (src-1a19264b6bb), version 3, backup v2 with 2 records, as expected.
Evidence: .claude/team/work/015-default-simulator/evidence/e2e-full.log (worker 0-4); .claude/team/work/015-default-simulator/qa.md "BUG-QA-1 root cause"
Suspected area: e2e/specs/migration-dup.e2e.ts, the "wrote version 3" test (line ~47). Product question for PM/staff: whether the unnamed fallback simulator should be stored at all (currently yes, hidden in the UI).
