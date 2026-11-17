---
name: project-reconnect-011
description: Work 011 (#1) reconnect after failed Reconnect accepted 2026-11-17; human chose to fix pre-existing e2e failures in the same change
metadata:
  type: project
---

Work 011 fixed issue #1: UI `failed` marker / connect error were not cleared by SessionStatus; auto-connect dropped
plug-ins while Connecting. Human did the physical test and accepted. Pre-existing e2e failures found by QA were fixed in
the same change (human chose "fix in this change" over a separate issue) — consistent with [[feedback-fix-before-commit]].

**Why:** the human wants the e2e suite green at each commit, even for failures not caused by the change.
**How to apply:** when QA reports red e2e on HEAD, default to fixing it in the current work item. Before asking the
human to run `npm run tauri dev`, check that no stray vite holds port 1420 (agents leave orphans). Related:
[[feedback-hardware-bugfix]], [[project-auto-connect]].
