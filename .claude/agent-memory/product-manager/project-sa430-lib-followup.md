---
name: project-sa430-lib-followup
description: sa430 lib work: 0.2.2 adopted (008: stoppable Monitor + spin fix); human squash-merges (stacked PRs conflict); lib workflow rules
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

2026-11-16 (work 008): human asked to make the sa430 Monitor stoppable for Studio's watcher thread → issue #76 / PR #77
(stop handle, `feat:` → 0.3.0) and pre-existing poll-error spin fix issue #78 / PR #79 (stacked on #77). Merged and
released as 0.2.2 (release-plz bumped patch for a `feat:` in 0.x); Studio adopted it (008 accepted + committed).
The human squash-merges: stacked PRs then conflict and need `git rebase --onto origin/main <old-base>` + force-push.
The human approved issue creation up front when asked once with the API choice — bundle those questions.
