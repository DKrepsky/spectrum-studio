---
name: feature-lifecycle
description: End-to-end development lifecycle for a Spectrum Studio feature or fix, run by the product manager - story, design, technical plan, implementation, QA, acceptance. Use when the human asks for any new feature, change or bug fix.
---

# Feature lifecycle (run by the product manager)

Use `.claude/team/bin/msg` for all handoffs (`team-messaging` skill). Skip stages that clearly
don't apply (no UI → no design stage; one-line fix → story can be a few lines), but say so.

## 0. Intake
- Pick the next work id: `ls .claude/team/work` → `NNN-slug`. Create `story.md` (template in
  `.claude/team/protocol.md`), status `draft`.
- Ask the human only what changes the outcome. Check `docs/roadmap.md` and existing code so the
  story reflects reality.

## 1. Story gate  — human approves
- Present the story and acceptance criteria concisely; apply feedback; set status `approved`.

## 2. Design (UI-visible work)
- `msg post --to designer --type request`; spawn `designer` with the work id.
- Major or workflow-changing features require `prototype/index.html` (functional, scenario
  switcher, long/realistic content) in addition to `design.md`; minor visual tweaks may skip it if
  the design says so.
- **Design gate - human validates the prototype** (open it for them / give the path) and the key
  decisions; loop until approved. Do not start planning or engineering before this.

## 3. Architecture & plan
- `msg post --to staff-engineer --type request`; spawn `staff-engineer`.
- Result: `plan.md`, `tasks/T*.md`, ADR if warranted. Sanity-check scope against the story.

## 4. Build
- For each task (parallel when independent): post `request` to `developer`, spawn `developer`
  with the task id (worktree isolation if tasks overlap). Collect handoffs in your inbox.
- Spawn `staff-engineer` to review; developers fix until the review report says approved.

## 5. QA
- Post `request` to `qa`, spawn it. QA must visually inspect every user-visible change (screenshots
  with realistic data, long names, narrow window; findings in `qa.md`). Reject a QA report whose UI
  criteria rest on tests only. For each `bug`, send fixes back to developers, re-run QA until
  its verdict is "ship" or you consciously accept the residual risk and record it.

## 6. Acceptance gate — human signs off
- Verify every criterion against QA evidence (open the key screenshots yourself before showing the human); confirm `npm run check` is green (`verify` skill),
  docs/roadmap/bindings updated.
- Write `outcome.md`. Report to the human: what shipped, evidence, known limitations, what you
  need from them. Set story status `accepted` or `rejected`.
- Update your memory with feedback and lessons. Archive finished messages.

## Rules
- You (PM) own the result. Never skip QA for behaviour changes. Never report unverified work as done.
- Don't commit/push unless the human asks.
