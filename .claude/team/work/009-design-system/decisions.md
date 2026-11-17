# 009 PM decisions on DESIGN.md 1.0-draft.2 open items (2026-11-16)
The human delegated all open items to the PM ("I trust you to take the best decision").

| ID | Decision | In 009? |
| --- | --- | --- |
| Q-1/Q-4 | Accept whole-item removal, order Frame, Rate, Noise floor, FFT, Avg, RBW; Unit + Uncalibrated never removed. Fixed **inside 009** (status bar is being rebuilt on tokens anyway; it is a CLAUDE.md honesty violation) with a 1024px regression test. | Yes (F0/E6) |
| Q-2 | "press Continuous" / "press Single"; user guide updated too. | Yes (copy only) |
| Q-3 | Unavailable/disabled opacity 0.6. | Yes (F9) |
| Q-5 | Zoom not a requirement in 009; record as unsupported. QA checks whether Ctrl+= / Ctrl+- zoom the webview and reports. | No |
| Q-6 | Glyph only in the toolbar source button. | Yes (no change) |
| Q-7 | Split peak click — behaviour change, deferred to backlog. Keep current behaviour. | No |
| Q-8, Q-9, Q-10, Q-12, Q-14 | Deferred to backlog as recommended. | No |
| Q-11 | Staff engineer assesses whether frames can carry sweep time; logged as bug candidate in backlog. | No (assessment in plan) |
| Q-13 | Staff engineer answers in plan.md; no behaviour change in 009 unless trivial. | No |
| Q-15 | ADR wins for technical behaviour; DESIGN.md wins for presentation. | Yes (doc) |
| Q-16 | Canvas reads tokens (no visual change); rendering internals stay out of scope. | Yes (E3) |
| Q-17 | Live-region policy as written. | Yes (B2/E7) |
| Q-18 | Remove type-ahead in the source popover (list of buttons, Up/Down + Tab). | Yes (B1) |
| Q-19 | Keep peak table hidden when detection off. | Yes (no change) |
| Q-20, Q-21 | Notice stack cap and waterfall auto-hide are behaviour changes → backlog. | No |
| Q-22 | Option B (other rows unavailable while acquiring, reason shown) → backlog work item with B3/B8. | No |

## Scope of 009 (final)
In: tokens (Appendix A, src/styles/tokens.css) + token tests; src/ui/ presentational components + boundary guard + ADR;
migration of feature code; canvas token read (E3); small fixes F1–F15 (F12 no visual change); F0 status bar;
B1 source popover semantics (+Q-18); B2 live-region policy; B7 ARIA clean-up; copy C1; docs (README link to DESIGN.md,
architecture, guidelines, user-guide "Play" wording, re-shoot docs/images/main-window.png); DESIGN.md §12 statuses
updated to reflect these decisions.
Out → backlog (roadmap): B3 start-up "Choose a source" before backend answers; B4 readout tables keyboard reachable;
B5 peak table cap; B6/Q-20 notice cap; B8 "No source connected" while connecting; Q-22 source switching while acquiring;
Q-7 peak click split; Q-8 keyboard plot; Q-9 trace line styles; Q-10 waterfall colour strip; Q-11 stale threshold;
Q-12 connect cancel; Q-5 zoom support; Q-21 waterfall auto-hide; custom tooltip.
Also backlog (found in T1): pre-existing flaky/red e2e tests on main — source-row 'ArrowRight ... Edit is not focus-within its row' (3/3 red), acquisition 'single capture takes exactly one sweep' (intermittent).
T3 deviations accepted (PM): NumberField keeps an invalid entry visible on Enter (DESIGN.md 4.4) and adds ArrowUp/Down;
FrequencyField fixes the legacy Escape-commits-draft bug (Escape now reverts). Busy-width deviation rejected → T11.
T5 decisions (PM): popover list navigation clamps at ends (no wrap) — accepted; Tab closes on focusout — accepted (behaviourally equivalent).
Open for staff-engineer review: T4 StatusDot halo as outline vs ring token; dialog 90px/18px padding literals (token or allow-list; DESIGN.md update via T12).
T5b: spinner overlays the label on label-only busy buttons (label masked, name kept) — accepted (PM).
T6 decisions (PM, after viewing compare-T1-vs-T6 composites):
- Boolean params: checkbox before label (matches every other checkbox in the panel) — accepted.
- Checkbox accent: WebKit default blue → teal (--color-accent) — accepted as new small fix F16; T12 documents it in DESIGN.md/design.md.
- Marker active row fill (Table active state) — accepted (DESIGN.md table active row).
- peak-search / Next peak / + Marker keep native disabled (e2e waitForEnabled) — accepted.
- Backlog: FFT/Window disable reason title-only (DESIGN 4.5 wants visible); "Maximum peaks" has no visible label.
T7 decisions (PM, after viewing statusbar-live-1024 etc.): Center/Span value text now primary colour (DESIGN 4.4) — accepted as F17;
Span select ~7px wider at 1024 — accepted (fits, toolbar fit tests green). T12 documents F16/F17 in DESIGN.md/design.md.
T9 row geometry (PM accepts designer ruling 0198): row stays 44px; 24x24 actions centred in badge column; badge fades out while actions show (replaced, never covered). Visual test redefined accordingly. Fixed-block visible heading deferred.
T9 visual review (PM, compare-T9 crops): restore before look where not an intended fix —
(a) restore ~3px gap between rows (47px pitch, row itself 44px); (b) badge back to vertically centred in the row (before), since actions are now centred (ruling 0198) the name-line badge is no longer needed; (c) "No new devices" note aligned with the heading/glyph column (F3); heading/content offsets match before or F3. Undo as ui secondary Button — accepted.
T10 decisions (PM, after compare-T10 crops — parity confirmed): (1) Save uses `busy` (aria-disabled, keeps focus) like Test, not native disabled → T11;
(2) dialog notes/errors go into an always-mounted polite container (DESIGN 9.6 rule 1) → T11; (3) owner/mismatch warnings role=status — accepted.
P11/P12/P13 (PM): all backlog, not 009; P12 prioritised (stale readouts look current — honesty). Added to docs/roadmap.md backlog. T12 stale comments (StatusDot.css 'until T9', e2e helper 'Play' comments) → QA/T11 sweep.
T11 decisions (PM): stacked label secondary also in SourceForm — accepted (restores pre-009 muted look); SourceButton stays feature markup (DESIGN 10.2 rule 1) — accepted.
T11 finish (PM): busy Save at full strength (busy ≠ unavailable) — accepted.
DESIGN draft.4 decisions (PM): keep 1.0-draft.4 (bump to 1.0 at acceptance); Q-23 chevron stays dimmed while a command runs (as built, pre-009 behaviour; full-strength variant → backlog); A10 native-disabled peak controls accepted, QA confirms visible reason.
Post-QA polish list (one developer, with any QA bugs): tokens.css + Appendix A stale "Proposed (F9/F15/B6)" comments; Field.css "DESIGN.md 3.6" → 4.4; rename capture.css.test.ts → SplitButton geometry test; ADR 0015 §5 note "legacy-controls layer removed in T11 (009)"; DESIGN.md Q-23 → Decided (designer). app.css spacing literals not in 2.9 → backlog (spacing guard).
QA verdict "don't ship yet" (PM decisions):
- BUG-1 plot tag uppercase (introduced T7, pre-009 had no text-transform) → restore original case.
- BUG-2 popover row focus ring → restore inside ring as before (B1 = no visual change).
- BUG-3 spacing/size literals → fix: on-scale values use scale tokens, off-scale values get named tokens or an explicit DESIGN.md 2.9 allow-list entry; extend the token guard to px literals in spacing/size properties (padding, margin, gap, inset/top/left/right/bottom, width/height/min-*) outside tokens.css with a documented allow-list. Exact pixel values must not change.
- Also: post-QA polish list above; visual spec waits for stable innerWidth before naming shots; investigate row-action reveal flake ("the row actions did not appear") — re-hover pattern like clickRowAction.
Final (PM): BUG-2 inside ring accepted (complete on all sides vs side-clipped before); toolbar 45px (was 48) with 30px controls recorded under F1.
