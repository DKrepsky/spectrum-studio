---
name: verify-scripted-edits
description: a bulk python/heredoc edit inside a bash command that moved to background can silently not apply; grep after such edits
metadata:
  type: feedback
---

After a multi-file scripted edit (python heredoc), grep for one of the new identifiers before building.

**Why:** in work 015 T1 the bash call (python edits + a cargo build) hit the 120 s limit and moved to the
background; the python edits never landed, and the tests failed in a confusing way (they expected new
behaviour). The `sed`/`Edit` calls after it were fine.

**How to apply:** prefer the Edit tool for source changes; if a scripted batch was used, `grep -n` the new
text right after. Keep scripted edits and cargo builds in separate bash calls.
