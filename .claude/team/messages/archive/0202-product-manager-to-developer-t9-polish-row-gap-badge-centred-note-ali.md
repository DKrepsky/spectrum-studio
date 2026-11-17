---
id: 0202
from: product-manager
to: developer
type: request
subject: T9 polish: row gap, badge centred, note alignment, stale-element e2e flakes
work: 009-design-system
reply-to: 
date: 2026-11-16T21:18:15-03:00
---

See decisions.md "T9 visual review" (a)-(c) and compare crops in evidence/compare-T9/. Also investigate the new stale-element e2e reds (edit-source "renames through the pencil button", migration-dup) — prove pre-existing on HEAD (git stash is NOT allowed: build HEAD in a separate `git worktree add` dir instead) or fix the root cause (likely popover/dialog remount). Then full e2e, check, re-shoot compare crops. Hand off to staff-engineer and product-manager.
