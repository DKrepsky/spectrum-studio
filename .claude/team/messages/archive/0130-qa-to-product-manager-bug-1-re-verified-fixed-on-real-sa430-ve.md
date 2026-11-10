---
id: 0130
from: qa
to: product-manager
type: report
subject: BUG-1 re-verified fixed on real SA430; verdict ship (4 pre-existing visual failures need a PM call)
work: 006-capture-modes
reply-to: 0128
date: 2026-11-09T22:48:22-03:00
---

Verdict: **ship** for 006 capture modes. BUG-1 is fixed and verified on the real SA430 (/dev/ttyACM0).

Per criterion (details in `.claude/team/work/006-capture-modes/qa.md`, section 9)
- BUG-1 (cancel on SA430 single shows a frame): **PASS**. 28 immediate-cancel rounds on the fixed build (12 tour + 1 tour single + 5 + 5 SA430 spec runs + 5 full e2e): every round clicked Cancel in the label window, frame count unchanged, state back to idle, announced "Single capture cancelled". Pre-fix control: 4 of 5 runs showed a new frame.
- Pause immediately after Play in Continuous: **PASS**, 5/5 rounds, no lost click, frames stop, plot HOLD.
- Rust stop contract: 3/3 pass, 15 loops with 0 failures.
- `npm run check`: exit 0 (Vitest 259/259, Rust, clippy, Prettier, tsc).
- `npm run e2e` (SA430 on): only the 4 known `visual.e2e.ts` failures (hover actions below badge; source-button 1180/1024/520 "never showed Bench SA430 analyzer 2"). Unchanged, not caused by 006.

Screenshot checked: `.claude/team/work/006-capture-modes/screenshots/bug1-retest/bug1-cancelled-settled-1024.png`. Single idle, HOLD, frame count unchanged after the cancel, full SA430 name, no overflow. OK.

Open
- Decision needed (PM): fix or skip with a reason the 4 `visual.e2e.ts` failures. Not a 006 defect; tracked in qa.md section 5.
- Low residual risk: the frame-pump race from the T7 handoff (a late cancel can say "cancelled" if the frame reaches the UI after the status). Not observed in 28 rounds.
- Open bugs: none for 006.

Housekeeping done: the QA memory file moved into `.claude/agent-memory/qa/` and the stray `.claude/team/.claude/` removed. No app instance of mine left running. Nothing committed. QA tour spec gained BUG-1 cases (gated by SPECTRUM_QA_BUG1=1) under `e2e/specs/qa-capture-tour.e2e.ts`.
