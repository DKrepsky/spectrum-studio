---
id: 0216
from: developer
to: staff-engineer
type: handoff
subject: T12 docs done: DESIGN.md 1.0-draft.3, docs/*, reconcile after T11
work: 009-design-system
reply-to: 0215
date: 2026-11-16T22:48:56-03:00
---

T12 (docs only) is done. No src/ code touched; nothing committed.

Files
- DESIGN.md (repo root): header (1.0-draft.3, status, work item F0-F17, ADR 0015); 0.1 Q-15 decided; 2.9 known off-scale token values (2.10 table and Appendix A untouched); 2.15; 3.4 (F0 mechanism = StatusStrip dropOrder); 3.5-3.9 (B5/B6/Q-21 deferred, zoom unsupported); 3.8 dialog offset/padding tokens; 4.4 (F17, stacked label secondary); 4.6 (F14, F16, T6 checkbox order); 4.11 and 4.12 (Save busy, dialog polite region, ParamForm framed); 5.1; 5.2 (B3 deferred, Q-13 cites ADR 0010 in 5.2.3, Q-22 option B deferred); 5.3; 5.10; 6.3/6.4/6.8/6.9; 7.6 (Q-11 design); 7.8; 8.2; 9.4; 9.6; 9.9-9.12; 10.3; 10.5; 12.1 (statuses per decisions.md; new rows F0, F1-F15, F16, F17, D1, D2); 12.2 (new Decision column, PM outcomes); 12.3 status line; 13.0 changelog entry; 14 (new After 009 column).
- docs/README.md (DESIGN.md and ADR 0015 links), docs/architecture.md (src/ui, src/components, tokens.css, src/plot, src/format rows; new "Frontend layers and design tokens" section), docs/guidelines.md (build UI from src/ui, boundary, tokens, formatting, design source), docs/user-guide.md (capture button wording, Tab/Up/Down popover keys, Uncalibrated at every width, "press Continuous/Single" hint), docs/testing.md (Guards row, wmctrl in prerequisites, ensureWindowFocus and waitForGone, visual before/after procedure; removed the stale "one known defect" sentence; Play wording), docs/roadmap.md (status 2026-11-16, 009 row "In QA", hover-actions defect removed, 2026-11-10 E2E bullet replaced by the T1 findings, new "Backlog (from work 009)" section).
- Work folder: design.md gets a status note and F16/F17 rows (designer file; F0-F15 status column left as the review state).

Checks
- Relative links in all edited docs resolve (scripted check).
- prettier --check passes for every edited doc (DESIGN.md, docs/*.md, design.md).
- npm run check: Rust part green (fmt, clippy -D warnings, cargo test: all "test result: ok"). Web part FAILS at format:check on files T11 is still editing, not on docs: src/styles/tokens.test.ts (prettier SyntaxError at line 32, "';' expected"), src/ui/boundary.test.ts, src/ui/cssImport.test.ts, src/ui/SplitButton/SplitButton.tsx, src/components/ParamForm.test.tsx, src/components/source/SourceDialog.tsx, src/components/capture/CaptureControl.test.tsx. Log: /tmp/claude-1000/-home-kr-workspace-spectrum-kit/c5c5a6ca-c824-4b80-b0e8-2a95388745fc/scratchpad/check.log. I did not run e2e (T11 owns it).

Reconcile after T11 lands (docs written against the tree as of now)
1. Legacy residue: DESIGN.md 13.0 says "None". Now: src/styles has app.css and tokens.css only; capture.css, sourceDialog.css, source.css deleted; no LEGACY_FILES in tokens.test.ts. If T11 keeps a residue file, edit the "Legacy residue" bullet in 13.0.
2. testing.md says the focus tests fail "with a message that names" wmctrl (true now). T11 step 13 (fail fast) keeps this true; if the message changes, update the line.
3. Save busy and the dialog polite region (DESIGN 4.12, 9.6, D1) are described as landed by T11; I saw busy={saving} and the role=status notes container in SourceDialog.tsx, but T11's tests are not verified by me.
4. Cascade and guards: DESIGN 10.3 and testing.md name src/ui/cssImport.test.ts and the ESLint override; cssImport.test.ts exists now.
5. Stale code comments I noticed (not docs, not mine): src/ui/StatusDot/StatusDot.css says "source.css (which stays until T9)"; e2e helper comments still say Play (e2e/specs/helpers.ts about l.135 and l.169, acquisition.e2e.ts l.112 title).
6. roadmap.md row 7 still says "Play/Pause toggle" (historical done row; left as written).

Open for you
- The P11, P12 and P13 Proposed items have no decision in decisions.md and no backlog entry. I did not invent one; the PM should say whether they go to the backlog.
- DESIGN 12.1 "Q-5" is recorded as unsupported, with a QA check (T13). No behaviour change.
