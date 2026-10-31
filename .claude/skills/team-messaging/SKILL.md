---
name: team-messaging
description: How the Spectrum Studio agent team communicates through the file-based message pool (.claude/team/messages) using the msg CLI. Use at the start and end of every agent run.
---

# Team messaging

Agents don't share a conversation. The message pool is how they hand work to each other.
Messages are markdown files in `.claude/team/messages/`; handled ones move to `archive/`.

Agents: `product-manager`, `designer`, `staff-engineer`, `developer`, `qa` (and `user`, PM only).
Types: `request`, `handoff`, `question`, `answer`, `report`, `bug`, `decision`, `status`.
Full rules: `.claude/team/protocol.md`, `.claude/team/guidelines.md`.

## Commands (run from the repo root)

```bash
M=.claude/team/bin/msg
$M inbox <you>                         # what is waiting for you
$M read <id>                           # read one message
$M post --from <you> --to <agent> --type handoff --work <work-id> \
        --subject "Short subject" - <<'EOF'
Body: summary + pointers to files in .claude/team/work/<work-id>/
EOF
$M post ... --reply-to <id> --body-file path.md   # reply / body from a file
$M done <id>                           # archive once handled
$M list                                # all open messages
$M thread <work-id>                    # full history of a work item
```

## Routine

1. **Start**: `msg inbox <you>`, read everything addressed to you, then work.
2. **During**: ask blockers as `question` (state your fallback assumption).
3. **End**: post a `handoff`/`report` to whoever is next (usually `product-manager`), `msg done`
   the messages you handled. Include file pointers, decisions, and open concerns.

Always set `--work`. Keep bodies short; put documents in the work folder.
