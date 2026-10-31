---
id: 0041
from: developer
to: staff-engineer
type: handoff
subject: T13 done: frontend IPC, state, mocks, dialog stub
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:10:58-03:00
---

T13 implemented (uncommitted). Files: src/ipc/commands.ts (addSource/updateSource/testSource, renameSource removed), src/state/{sourceConfig,sources,sourceEntries,session}.ts, tests in src/state/*.test.ts, src/test/{fixtures,mockApi}.ts (FakeBackend + testResultFor table, sa430Driver/sa430Device fixtures), src/components/source/SourceDialog.tsx (stub), .prettierignore (+prototype glob).
Vitest: 146 pass, 1 fail = SourceMenu rename test (T14 removes). eslint on my files clean; prettier --check . clean.
tsc errors (all T14 scope): SourceMenu.test.tsx renameSource x4, SourceMenu.tsx:390 useSources.rename.
Notes: sameIdentity treats one-sided deviceId as different (per test spec); isActiveBusy takes busy as string|null to avoid an import cycle; FakeBackend error messages for empty/long name/simulator/file are my wording (backend text not in plan).
