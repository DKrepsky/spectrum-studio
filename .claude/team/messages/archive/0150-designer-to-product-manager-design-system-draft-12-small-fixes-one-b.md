---
id: 0150
from: designer
to: product-manager
type: handoff
subject: Design system draft + 12 small fixes + one bug candidate, ready for the design gate
work: 009-design-system
reply-to: 0149
date: 2026-11-16T17:01:08-03:00
---

Designer deliverables for 009 are ready for the design gate. No production code was changed.

Files
- /home/kr/workspace/spectrum-kit/DESIGN.md (repo root, untracked until you ask to commit): principles, tokens (CSS custom property names, primitive and semantic layers, capture semantics, contrast table), layout, component catalogue (P1 list for src/ui/), patterns, copy rules, accessibility, governance, gap list, open questions D1 to D6 and engineering items E1 to E5.
- .claude/team/work/009-design-system/design.md: inventory of hard-coded values with counts, duplicates across CSS and plot/theme.ts, token mapping (current name to target), fixes F1 to F12 with measured before/after, finding F0, copy findings C1 to C3, decisions for the gate.
- .claude/team/work/009-design-system/prototype/index.html: one file, built from the real src/styles CSS. Scenario switcher (Empty, Typical, Long text, Error), width switch (1440, 1180, 1024). Views: Tokens, Components, Small fixes (current vs proposed, values measured in the browser), Screens (overlays: source menu, capture mode menu, dialog).
- PNGs in prototype/: screenshot-tokens-1440.png, screenshot-components-1440.png, screenshot-small-fixes-1440.png, screenshot-screens-1440-typical.png, screenshot-screens-1024-long-source-menu.png, screenshot-screens-1024-error-dialog.png.

Small fixes (design.md section 3)
- F1 Toolbar Center field and Span select to the 30px control height (measured 28.2px and 26px today).
- F2 Small and icon buttons to a 24px minimum target (22.8px and 20px today; WCAG 2.2 2.5.8).
- F3 Menu headings aligned to the glyph column (source heading 3px off today); one heading style.
- F4 Capture mode menu focus ring drawn outside like every other control (offset -2px today).
- F5 Status bar from 11.5px (orphan size) to 11px.
- F6 Dialog help text from 11px to 12px.
- F7 Dialog field labels from 12px to 13px (match toolbar and side panel).
- F8 Inline connect-form error to 12px (inherits 13px today).
- F9 Disabled inputs from 0.5 to 0.45 opacity (match disabled buttons).
- F10 Amber banner tint from 10% to 12% (match red).
- F11 Dialog group legend aligned with field labels (4px indent today).
- F12 Remove unused --warn-strong token (no visual change).

Bug candidate, not a small fix (design.md section 4, F0)
- At the 1024px minimum window, the status bar hides "Uncalibrated" entirely and cuts "Frame" mid-text. I measured this in the browser with the real CSS. This matters for CLAUDE.md's rule on uncalibrated data. Proposal in the prototype: Unit and Uncalibrated stay whole; Rate and Frame are removed whole below 1180px. Suggest tracking this as a bug now, separately from the token work, with a layout test.

Decisions the human should review at the gate
1. Approve or edit F1 to F12. F1, F2 and F4 are the accessibility or alignment ones I would keep.
2. F0: accept the proposal, choose an alternative, or track as a bug.
3. C1: "press Play" appears in the status bar, the plot hint and the user guide; the button shows the mode name. Proposal: "press Continuous" / "press Single".
4. DESIGN.md open questions D1 to D6 (section 11), in particular D3 (the teal attention outline on "Choose a source") and D4 (native titles as the only tooltip).

Notes for PM and the staff engineer
- The docs link is not added: docs/README.md should link /DESIGN.md (story acceptance). I did not edit docs (designer scope is the design files).
- docs/images/main-window.png is stale (shows Stop, SIMULATED, Export CSV). Re-shoot after the fixes.
- The CSS contract tests (capture.css.test.ts, source.css.test.ts) pin literal values; they move to token names with the token change (E4).
- QA still needs real WebKitGTK measurements: this machine has no Inter or JetBrains Mono, so the prototype uses the Ubuntu and DejaVu fallbacks.
- Memory updated for future design work (designer memory only).
