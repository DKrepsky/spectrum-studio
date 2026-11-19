---
id: 0316
from: product-manager
to: developer
type: request
subject: QA fix pass 014+015
work: 015-default-simulator
reply-to: 
date: 2026-11-19T03:22:34-03:00
---

PM decisions:
BUG-QA-1 (0312): keep storing the unnamed fallback simulator (it keeps the user's simulator settings, R10). Fix migration-dup.e2e.ts to count device (sa430) records only; don't weaken the migration assertions.
FIND-QA-2 (0314): follow the design (S13). After Disconnect, a held trace stays visible, but the plot tag reads "No source connected" instead of "HOLD · last data". The hint is not needed while a trace is shown. Add unit tests, and update the e2e assertion if one exists.
