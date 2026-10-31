# Spectrum Studio — agent team

A virtual product team for this repo. The human talks **only to the Product Manager**.

```
                         ┌───────────────┐
        you  ◀──────────▶│ product-manager│  (main-thread agent; owns outcomes)
                         └─┬───┬───┬───┬─┘
              stories      │   │   │   │      results / reports
           ┌───────────────┘   │   │   └──────────────┐
           ▼                   ▼   ▼                  ▼
      designer        staff-engineer  developer(s)     qa
   (UX/UI specs)   (architecture, plan,   (implement)  (test, bugs)
                    review, task split)
```

## How it works

- **The PM is the main-thread agent** (`"agent": "product-manager"` in `.claude/settings.json`).
  Claude Code subagents cannot spawn other subagents, so only the main thread can dispatch work.
  The PM launches `designer`, `staff-engineer`, `developer` and `qa` via the Agent tool.
- **Message pool** (`.claude/team/messages/`): every handoff is a message file, managed with
  `.claude/team/bin/msg`. Agents have no shared conversation, so the pool *is* their communication.
  Details: `.claude/skills/team-messaging/SKILL.md` and [protocol.md](protocol.md).
- **Work items** (`.claude/team/work/<id>-<slug>/`): story, design, technical plan, QA report — one
  folder per feature, written by the owning role. See [protocol.md](protocol.md).
- **Per-agent memory** (`.claude/agent-memory/<agent>/MEMORY.md`): each agent reads it at start and
  records durable, role-relevant learnings. Configured with `memory: project` in the agent files.
- **Lifecycle**: `/feature-lifecycle` skill describes the flow
  (story → design → architecture → build → QA → acceptance).

## Flow of a feature

1. You describe a need to the PM. PM asks you clarifying questions, writes the **user story** with
   acceptance criteria, and gets your OK.
2. PM → **designer**: story. Designer returns a **design spec** (flows, states, copy, a11y).
3. PM → **staff-engineer**: story + design. Returns a **technical plan** split into small tasks
   (and ADRs for significant decisions).
4. PM spawns **developer** agents per task (parallel when tasks are independent; use worktree
   isolation for parallel Rust/TS edits).
5. Staff engineer reviews the result; PM spawns **qa**, which verifies against the acceptance
   criteria and files bug messages. Bugs go back to developers until clean.
6. PM checks every acceptance criterion with evidence, reports to you, and asks for your sign-off.
   The PM is accountable for the outcome — nothing is "done" without PM acceptance.

## Layout

| Path | Purpose |
| --- | --- |
| `.claude/agents/*.md` | The five agent definitions |
| `.claude/agent-memory/<agent>/` | Private memory per agent |
| `.claude/team/messages/` | Open messages (`archive/` holds handled ones) |
| `.claude/team/work/` | Per-feature artifacts |
| `.claude/team/bin/msg` | Message pool CLI |
| `.claude/team/protocol.md` | Message types, work-item layout, definitions of ready/done |
| `.claude/team/guidelines.md` | Shared rules every agent follows |
| `.claude/skills/` | `feature-lifecycle`, `team-messaging` (+ existing `verify`, `add-source-integration`) |

Start with: `claude` in the repo root, then just tell the PM what you want.
