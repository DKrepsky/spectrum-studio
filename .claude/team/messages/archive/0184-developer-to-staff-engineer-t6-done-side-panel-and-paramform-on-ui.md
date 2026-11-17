---
id: 0184
from: developer
to: staff-engineer
type: handoff
subject: T6 done: side panel and ParamForm on ui/
work: 009-design-system
reply-to: 0180
date: 2026-11-16T19:51:59-03:00
---

T6 done: side panel and parameter forms on src/ui/ (uncommitted, main tree).

Files
- src/components/SidePanel.tsx: ui Section for all five sections (open defaults unchanged, Source settings closed).
- src/components/panels/{Measurement,Markers,Peaks,Display,Source}Panel.tsx: Field (layout inline), NumberField, Select, Checkbox (swatch via adornment), Button small, IconButton ghost, Table, InlineMessage. No raw button/input/select/details/table left.
- src/components/ParamForm.tsx: maps ParamSpec to ui fields; Hz numbers use FrequencyField (Escape fix); new `layout` prop, default `stacked` (dialogs keep stacked fields), SourcePanel passes `inline`.
- src/components/NumberInput.tsx: deleted (FrequencyInput kept for Toolbar, T7).
- src/styles/app.css: removed .panel*, .form-row*, .with-unit, .unit, .readout-table*, .row-actions, .param-field*, .required. Added .panel-row and .table-actions; swatch and marker/peak id colours now tokens. Kept .hint, .error, .button-row (SourceForm and SourceDialog, T9/T10) and .param-form/.param-group (dialogs use ParamForm). So tokens.test LEGACY_FILES keeps app.css (not clean yet).
- src/ui/Section/Section.css, src/ui/Table/Table.css: comment only ("removed in T6").
- e2e/specs/visual.e2e.ts: peak row filter `.hint` -> `.ui-table-empty`. e2e/tools/screenshot.ts: swatch selector now `.ui-checkbox__adornment .swatch.max-hold`.

Tests
- ParamForm.test.tsx: queries unchanged (labels still work); + Escape reverts a frequency draft; + inline/stacked layout.
- SidePanel.test.tsx (new): sections render as ui Section with the right titles and open state; guard that SidePanel, ParamForm and panels/*.tsx contain no raw button/input/select/details/summary/table.

Checks
- npm run check: exit 0 (log: scratchpad check-T6.log). Run before the two comment-only edits in src/ui CSS; afterwards vitest src/ui src/styles src/components: 33 files, 359 tests pass; prettier clean.
- Build: npx tauri build --debug --no-bundle exit 0.
- e2e visual spec: 1 failure, "hover actions sit below the badge pill" (the known red on main). All side-panel tests pass at 1440 and 1024, plus the toolbar and side-panel fit guard. Log: scratchpad e2e-T6-visual.log. Shots: evidence/after-T6/ (98 files), composites T1 left / T6 right: evidence/after-T6/compare-T1-vs-T6/.
- Port 4444 was held by another live wdio run at first; I waited for it to finish and did not kill it.

Deviations (and why)
1. peak-search, Next peak, + Marker keep native `disabled`, not `unavailable`. acquisition.e2e does waitForEnabled on peak-search; aria-disabled reads as enabled at once, so the click is lost. The reason (no peaks) shows in the table.
2. Reset (holds) is `unavailable` as the staff note says.
3. Marker table only renders with markers; with none, the hint text shows as before. Peak table shows the empty text only with a frame, as before.
4. "Maximum peaks" keeps its hidden label (aria-label only) and the "max" unit, as before.
5. Field labels are strings, so `required` is " *" in the text, not in danger colour. No driver sets required today (grep crates: none).
6. ParamForm bool: ui Checkbox puts the box before the label. The old row had the box on the right. This is a visible change not in F1/F2/F9/F14/F15 (see PM handoff).
7. Gap in checks rows 14px -> 12px (--space-5); swatch radius 2px -> 4px token. Same colours.

Open
- F2 (24px targets) not probed numerically; only seen in shots.
- 1024 side-panel shots checked by the e2e guard and pixel diff, not viewed one by one (the column is the same 330px).
- The DESIGN 4.5 "reason in the description" for the trace-source FFT/Window disable is still title-only (as before).
