---
id: 0281
from: developer
to: product-manager
type: handoff
subject: 012 third fix pass done: BUG-012-QA-2 fixed (Source settings read-only while applying), DESIGN.md corrected
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T02:01:35-03:00
---

Third fix pass for work 012 (issue 38) is done, uncommitted. Details: .claude/team/work/012-measurement-center-span/dev.md, section "Third fix pass".

BUG-012-QA-2 (Enter on a Source settings Hz param drops focus): fixed.
- ParamForm takes readOnly and passes it to every control; SourcePanel passes readOnly while applying (not disabled).
- Native readOnly on FrequencyField, NumberField (also no stepping), TextField; Select keeps aria-readonly; Checkbox gets a readOnly prop (aria-readonly, changes ignored, read-only opacity).
- Tests: ParamForm.test.tsx (read-only form, Enter keeps focus), Field.test.tsx (Checkbox), NumberField.test.tsx (read-only), acquisition.e2e.ts (Tone 1 100.3M + Enter keeps focus in #source-tone1Hz, then restores 100.25M).

DESIGN.md corrected with QA round-2 numbers: 3.2 (no toolbar overlap down to 465 CSS px; capture control passes the window edge at about 427 CSS px), 3.9 rows 150% (683 px: toolbar fits, status bar keeps 7 items) and 200% (512 px: toolbar fits, status bar keeps 5), with the simulation caveat (root CSS zoom at 1024 px, media queries not re-evaluated; webview zoom keys do nothing in this build). Q-5 support status unchanged. 4.4 gained the read-while-applying rule.

Checks: npm run check EXIT 0 (cargo fmt, clippy, cargo test, Prettier, ESLint, tsc, Vitest).
E2E (debug build from the current tree, WebKitWebDriver from the scratchpad copy): acquisition.e2e.ts 18 passing (includes the new Source settings focus test); visual.e2e.ts 47 passing, 3 skipped (the hardware-only cases, as before); failures.e2e.ts 3 passing. One earlier acquisition run failed only because the new test had a strict-mode selector bug; fixed and re-run green. Not run: sa430, persistence, status-bar, migration, add-source, edit-source, source-row specs (not touched by this pass).

Open for the PM: none new from this pass. Span and the other ParamForm controls are covered by the same readOnly path (no separate issue needed).
