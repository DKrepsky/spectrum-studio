---
id: 0217
from: developer
to: product-manager
type: handoff
subject: T12 docs done: what changed, backlog recorded, items for QA
work: 009-design-system
reply-to: 0215
date: 2026-11-16T22:48:56-03:00
---

T12 (docs) is done. Details and the reconcile list are in the staff-engineer handoff of this work item.

What the docs now say
- DESIGN.md is 1.0-draft.3 (2026-11-16) and reads "Implemented in work 009 (T1 to T11); visual QA (T13) pending". Every decision in 12.1 carries its status per decisions.md: F0 to F15 implemented, F16 and F17 accepted and implemented, B1 (popover semantics, no type-ahead) and B2 (live regions) and B7 implemented, B3, B4, B5, B6, B8, Q-22 option B, Q-7 split, Q-8, Q-9, Q-10, Q-11, Q-12, Q-20, Q-21 and the custom tooltip deferred to the backlog. Q-5 zoom is recorded as unsupported (QA checks Ctrl+= and Ctrl+- in T13). Q-15 is decided (ADR wins for technical behaviour, DESIGN for presentation). Q-13 is answered from ADR 0010 (5.2.3). Q-11 carries the sweepIntervalMs design from plan.md section 9.
- 12.2 has a new "Decision (PM, work 009)" column with the outcome for each question.
- The changelog entry 13.0 lists the applied decisions, the corrections (3.8 dialog padding tokens, 4.12, 4.4, 4.11, 5.1) and the backlog.
- Section 14 has an "After 009" column next to the measured gap list.
- The 2.10 token table and Appendix A are unchanged. The off-scale values (row gap, capture main gap and padding, frequency field padding, plot tag padding) are listed in 2.9 as known exceptions.

Docs
- docs/README.md links DESIGN.md and ADR 0015. docs/architecture.md has the src/ui, src/components, tokens, src/plot and src/format rows and a frontend section. docs/guidelines.md has the UI rules (build from src/ui, boundary, tokens, formatting, design source). docs/user-guide.md uses the capture-button wording (Continuous and Single), documents popover keys, and says Uncalibrated stays visible at every width. docs/testing.md adds the Guards row, wmctrl as a prerequisite, ensureWindowFocus and waitForGone, and the before and after visual procedure. docs/roadmap.md: 009 is "In QA"; the hover-actions defect is removed; there is a new "Backlog (from work 009)" section with B3, B4, B5, B6 (Q-20), B8, Q-22, Q-7, Q-8, Q-9, Q-10, Q-11, Q-12, Q-5, Q-21, the custom tooltip and the later items from decisions.md.

For you (PM)
1. P11 (one frequency unit per axis), P12 (Last data time in readouts) and P13 (over-range indicator) are Proposed in DESIGN.md but have no decision in decisions.md and no backlog entry. Tell me if they go to the backlog; I did not invent entries.
2. docs/user-guide.md still shows images/source-menu.png and images/edit-source.png. Those may predate 009; QA should check them in T13 along with docs/images/main-window.png (which I did not touch).
3. Verification: links and prettier pass for every doc. npm run check: Rust is green; the web part fails at format:check on files T11 is still editing (src/styles/tokens.test.ts has a prettier syntax error at line 32, plus several src/ui and src/components files). That is code, not docs, and needs T11 to finish. e2e not run by me.
4. The status bar wording in user-guide and DESIGN is the current UI; B8 ("Connecting…" copy) is still backlog, so the status bar and plot still say "No source connected" while connecting. Docs say that, consistent with the decisions.
