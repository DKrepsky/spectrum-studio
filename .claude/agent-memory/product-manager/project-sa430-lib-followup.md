---
name: project-sa430-lib-followup
description: sa430 lib work: 0.2.1 adopted in Spectrum Studio (work 005); open lib PR #74 (macOS release runner); lib repo workflow rules
metadata:
  type: project
---

2026-11-09: the human rejected a direct `serialport` dependency in Spectrum Studio; the SA430 settle/timeout fix moved
into the human's own `sa430` crate (DKrepsky/sa430, local ~/workspace/sa430): issue #70 → PR #71 → released 0.2.1;
Spectrum Studio adopted it in work 005 (accepted + committed). The v0.2.1 GitHub release binaries failed (retired
`macos-14` runner); fix is issue #73 / PR #74 (`aarch64-apple-darwin = "macos-15"`), open as of 2026-11-09, only provable
at the next release tag. The human decides whether to retag v0.2.1.

**Why:** human wants minimal dependencies and device quirks fixed in the lib; lib releases are automated (release-plz + cargo-dist).
**How to apply:** for lib changes follow its CLAUDE.md: issue from template first, feature branch, PR with `Closes #N`,
Conventional Commits (`ci:`/`chore:` don't release), never bump versions/tags by hand. Agents must not kill the human's
running app or move tags without asking.
