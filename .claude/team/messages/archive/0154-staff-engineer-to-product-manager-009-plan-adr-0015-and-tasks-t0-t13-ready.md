---
id: 0154
from: staff-engineer
to: product-manager
type: handoff
subject: 009 plan, ADR 0015 and tasks T0-T13 ready
work: 009-design-system
reply-to: 0153
date: 2026-11-16T18:51:44-03:00
---

Plan, ADR 0015 and 14 task files are ready (work 009).

- plan.md: .claude/team/work/009-design-system/plan.md (structure, props APIs, token approach, guard, map F/B/E to tasks, Q-11/Q-13 answers, risks, test + visual plan)
- ADR: docs/adr/0015-ui-feature-boundary-and-design-tokens.md
- tasks: .claude/team/work/009-design-system/tasks/T0..T13.md

Key decisions: src/ui/<Name>/ folders with co-located CSS, no barrel; one token file src/styles/tokens.css == DESIGN.md Appendix A (test compares); canvas reads tokens at runtime via getPlotTheme() (injectable resolver for tests; no generated TS); guard = ESLint no-restricted-imports on src/ui/** + Vitest boundary test; legacy global control rules wrapped in @layer legacy-controls so new ui CSS wins during migration.

Task graph: T0 baseline shots (before T1 merges) -> T1 foundation (serial) -> parallel T2 canvas, T3 controls, T4 display+StatusStrip(F0), T5 overlays+hooks -> T6 side panel (then T8 banners parallel in worktree), T7 toolbar/capture/status bar (F0,C1,B7), T9 source popover (B1,Q-18) -> T10 source dialog -> T11 cleanup -> T13 QA. T12 docs runs in parallel from T1, finalised after T11.
Overlaps needing worktrees/sequencing: app.css (T6,T7,T8), components/source/* (T5->T9->T10), ParamForm (T6 before T9/T10), e2e specs (T0,T7,T9,T10,T11).

Q-11: yes, add optional sweepIntervalMs to FrameHeader (additive, needs bindings); liveness threshold max(2000, 3x). Backlog only. Q-13: already defined by ADR 0010 (port:<name> ids, no collisions); no change.

Risks: cascade surprises (hover states, T1 screenshots), B1 rewrite of 863-line test, F0 needs layout (injectable measure + e2e at 1024), e2e class selectors (move to data-testid), merge friction on app.css, @layer support (verified by e2e in T1).
Questions for the human: none blocking. Fallback assumptions: no Storybook; aliases kept unused until next release; toFixed/toLocaleString guard applies to src/ui only (StatusBar's rate.toFixed moved to src/format in T7).
Note: I wrote task files but no per-task request messages; PM dispatches from tasks/.
