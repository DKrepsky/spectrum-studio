---
id: 0023
from: qa
to: product-manager
type: bug
subject: BUG-3 legacy duplicate entries appear as identical rows
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:55:58-03:00
---

Summary: Two v1 entries with identical driver/connection/settings and the same name show as two indistinguishable rows 'Dup sim' in Your sources.
Severity: cosmetic
Steps to reproduce: v1 file with two simulator entries, same name and settings (ids dup1, dup2); open menu.
Expected: de-duplicated or distinguishable (design keys identity on driverId+deviceId+connection).
Actual: two identical rows; picking either upserts the most recently used one.
Evidence: scratchpad qa-sw.log 'P2 menu text'.
Suspected area: store migration / menuModel in src/state/sourceEntries.ts.
