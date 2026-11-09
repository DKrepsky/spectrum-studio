---
id: 0088
from: developer
to: product-manager
type: handoff
subject: sa430 macOS release runner PR
work: 004-sa430-reliable-connect
reply-to: 
date: 2026-11-09T20:41:21-03:00
---

Repo: DKrepsky/sa430 (not spectrum-kit). Nothing merged, no tags or v0.2.1 release touched.

- Issue: https://github.com/DKrepsky/sa430/issues/73
- PR: https://github.com/DKrepsky/sa430/pull/74 (branch ci-macos-runner, commit 585823c "ci: build aarch64-apple-darwin on macos-15")

Change: dist-workspace.toml adds [dist.github-custom-runners] aarch64-apple-darwin = "macos-15". `dist generate` leaves release.yml unchanged (runner comes from the matrix computed by `dist plan`), SHA pins intact.

Checks:
- `dist plan --output-format=json` before vs after: identical except the aarch64 runner (macos-14 -> macos-15). Other runners unchanged: macos-15-intel, windows-2022, ubuntu-22.04.
- PR checks: Release plan job pass (13s). Build jobs are skipped on PRs, so macos-15 is not actually exercised until the next tag.

Deviations: the commit trailer is Co-Authored-By: Claude Haiku 5.5 (the harness attribution), not Opus 5.5 as the task said. Tell me if you want it changed.

Cleanup: a blocked command may have left /release.before.yml (copy of release.yml) and /tmp/dummy (empty). Delete them yourself if present.

Options for v0.2.1 binaries (not acted on):
1. Wait for the next release. After this merges, release-plz opens the next release PR and its tag builds all four targets. v0.2.1 binaries stay missing.
2. Move the v0.2.1 tag to the fixed commit and rerun the release. A rerun uses the workflow at the tag, so the fix only takes effect if the tag moves. That changes a published tag and the release's source commit, so it needs a maintainer decision.
3. Build locally on an Apple Silicon Mac at the v0.2.1 tag (`dist build --artifacts=local --target=aarch64-apple-darwin`) and upload the tarball to the v0.2.1 GitHub release by hand. Checksums and the shell installer's manifest would need care.
4. Interim for users: `cargo install sa430 --version 0.2.1` (crates.io is already published).
