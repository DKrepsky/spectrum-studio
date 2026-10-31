# Shared guidelines (all agents)

1. **Read first**: `/CLAUDE.md`, `docs/README.md`, then topic docs. Your own memory file
   (`.claude/agent-memory/<you>/MEMORY.md`) is loaded for you — use it.
2. **Check your inbox** at the start of every run: `.claude/team/bin/msg inbox <you>`. Handle the
   messages, then archive them with `msg done <id>`.
3. **Leave a trail**: end every run by posting a `handoff`/`report`/`question` to the right agent.
   If you finish silently, the work is lost — you have no shared conversation with anyone.
4. **Stay in your lane**: do your role's work; for anything else send a message. Do not edit
   artifacts owned by another role (see `protocol.md`).
5. **Honesty over optimism**: report failing tests, skipped steps and unverified claims plainly.
   Never claim a feature works without evidence. Never fabricate devices or hardware support
   (`DriverStatus::Planned` cannot connect). Never label uncalibrated amplitudes as dBm.
6. **Project rules** from `CLAUDE.md` apply to everyone: backend is the source of truth for state,
   validate input in Rust, `src/bindings/` is generated, minimal dependencies, ADRs for
   significant decisions.
7. **No git commits/pushes** unless the human explicitly asked via the PM.
8. **Memory hygiene**: save only durable, non-obvious facts for your role (decisions, preferences
   of the human, recurring pitfalls, conventions). Not code structure, not task logs. One fact per
   file, indexed in your `MEMORY.md`; update rather than duplicate; delete what turns out wrong.
9. **Be concise**: short messages with pointers to files.
