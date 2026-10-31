# Team protocol

## Message types

| Type | Use |
| --- | --- |
| `request` | Ask someone to do work (PM → role, staff-engineer → developer). Must state the deliverable and where to write it. |
| `handoff` | Deliver finished work. Points at files; lists open concerns. |
| `question` | Blocking or clarifying question. State what you will assume if no answer comes. |
| `answer` | Reply to a question (`--reply-to`). |
| `report` | Review, QA or status outcome with evidence. |
| `bug` | QA → PM/developer. Use the bug template below. |
| `decision` | A recorded decision others must follow. Significant ones also become an ADR. |
| `status` | Short progress note. |

Rules: one subject per message; always set `--work <id>`; reply with `--reply-to`; archive
(`msg done`) a message once handled. Messages carry *pointers and summaries*, not big documents —
put documents in the work folder.

## Routing

- Only the **PM** talks to the human (`to: user` messages are PM-only; the PM relays them with
  AskUserQuestion). Other agents put questions for the human into a `question` to `product-manager`.
- Designer ↔ staff-engineer may exchange `question`/`answer` directly (feasibility), copying the
  PM's work folder, but scope changes always go through the PM.
- Developers report to the staff-engineer (`handoff`), and the staff-engineer reports to the PM.
- QA reports to the PM; bugs are cc'd to the staff-engineer via a second message.

## Work item layout

`.claude/team/work/<NNN>-<slug>/` (NNN = next free number)

| File | Owner | Contents |
| --- | --- | --- |
| `story.md` | PM | User story, acceptance criteria, scope, out-of-scope, status |
| `design.md` | designer | Flows, layout, states (empty/loading/error), copy, a11y, open questions |
| `prototype/` | designer | `index.html`: functional, self-contained clickable prototype with a scenario switcher. Required for major or workflow-changing features; minor tweaks may skip it but `design.md` must say so |
| `plan.md` | staff-engineer | Approach, modules touched, task list with owners/dependencies, risks, test plan |
| `tasks/T<n>.md` | staff-engineer | One developer task: goal, files, acceptance, tests required |
| `qa.md` | qa | Test matrix, results, evidence, bug links, visual-inspection findings with screenshot paths |
| `screenshots/` | qa | Screenshots referenced from `qa.md` (state, window size, data used in the file name) |
| `outcome.md` | PM | Final acceptance against each criterion, what the user said |

### story.md template

```
# <id> <title>
Status: draft | approved | designing | planning | building | qa | accepted | rejected
As a <user>, I want <capability>, so that <benefit>.
## Acceptance criteria
- [ ] Given … when … then …
## Out of scope
## Notes / constraints (units, hardware honesty, data safety — see CLAUDE.md)
```

### Bug template (message body)

```
Summary:
Severity: blocker | major | minor | cosmetic
Steps to reproduce:
Expected:
Actual:
Evidence: (command output, screenshot path, test name)
Suspected area:
```

## Definitions

- **Ready for design/plan**: story approved by the human, acceptance criteria testable. For major
  or workflow-changing UI work, additionally: the human has validated `prototype/index.html`
  (design gate); engineering does not start before that.
- **Visually verified**: QA has run the real app (or the real built UI), captured screenshots of
  the changed UI in realistic and worst-case states, looked at them, and recorded findings in
  `qa.md`. A UI criterion never passes on tests alone.
- **Done**: every acceptance criterion verified by QA with evidence (UI criteria: visually verified, screenshots attached); `npm run check` green; docs
  and `docs/roadmap.md` updated; regenerated bindings committed; PM has reported to the human and
  the human has accepted. Features are never "done" because UI exists (see `CLAUDE.md`).

## Git

Agents do not commit or push unless the human asks the PM to. Developers leave changes in the
working tree (or their worktree branch) and report the diff summary.
