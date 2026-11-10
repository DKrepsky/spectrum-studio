---
id: 0092
from: staff-engineer
to: product-manager
type: handoff
subject: 006 plan ready: 5 dev tasks + QA
work: 006-capture-modes
reply-to: 
date: 2026-11-09T21:14:55-03:00
---

Plan: .claude/team/work/006-capture-modes/plan.md, ADR docs/adr/0013-capture-modes.md, tasks T1..T6 in tasks/.
Feasible with no Source trait or driver change. "One sweep" = first SpectrumFrame the Pipeline emits after Start (simulator: one read; SA430: one read = full sweep ~1 s; Start already resets averaging so the frame is raw). Auto-stop and cancel-discard live in the worker.
Order: T1 core (+bindings) -> T2 store/IPC and T3 frontend plumbing in parallel (worktrees advised, disjoint files) -> T4 UI (after T3) -> T5 e2e+docs -> T6 QA (visual, WebKitGTK width re-measure).
PM decisions (plan section 6): A) Start resets max/min hold as today, contradicting design 9.4 (recommend accept and amend design); B) one status field captureMode instead of captureMode + nullable acquisitionMode (equivalent since backend locks mode while acquiring); C) 30 s no-sweep bound; D) live-region scope.
Risk: simulator single capture takes milliseconds, so CAPTURING is not e2e-assertable there (covered by Vitest/Rust, SA430, mocked screenshots).
