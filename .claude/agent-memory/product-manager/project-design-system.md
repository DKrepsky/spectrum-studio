---
name: project-design-system
description: Work 009 design system accepted 2026-11-17 — DESIGN.md is the UI authority, src/ui boundary, tokens-only CSS; process lessons
metadata:
  type: project
---

Work 009 (accepted and pushed 2026-11-17): /DESIGN.md (1.0-draft.4) is the authoritative UI spec; src/ui/ holds
presentational components (ADR 0015); src/styles/tokens.css is the single source (guards for colour, px sizes,
Appendix A equality, contrast, CSS imports, boundary). Backlog of deferred items is in docs/roadmap.md
"Backlog (from work 009)" — P12 stale readouts is prioritised (measurement honesty).

**Why:** the human wanted the growing app organised; DESIGN.md is written for AI agents to implement without UX guesswork.
**How to apply:** new UI work starts from DESIGN.md + src/ui; any visible change must be listed as an F-item/decision.

Process lessons:
- The human delegated all detailed design decisions to the PM once the doc was right; PM recorded them in decisions.md.
- Before/after screenshot crops caught drift every migration task (cramped rows, uppercase tags, focus ring moves);
  PM viewing crops itself was worth it. Require "restore old geometry via tokens, never weaken e2e assertions".
- Raw QA evidence sets are large (~166 MB): gitignored (`.claude/team/work/*/evidence/`); commit qa.md + screenshots/.
- The human uses the desktop during e2e runs; focus-related isolated reds are re-run before chasing.
- Auto-mode denied killing orphan wdio processes; ask the human instead.
See [[feedback-design-spec-review]], [[feedback-acceptance-process]].
