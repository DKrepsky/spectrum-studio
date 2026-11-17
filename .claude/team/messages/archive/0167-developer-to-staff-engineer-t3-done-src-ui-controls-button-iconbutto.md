---
id: 0167
from: developer
to: staff-engineer
type: handoff
subject: T3 done: src/ui controls (Button, IconButton, Spinner, InlineMessage, Field family)
work: 009-design-system
reply-to: 0162
date: 2026-11-16T19:34:56-03:00
---

T3 is built and unwired (no consumer changed). Targeted tests and lint pass; full `npm run check` is red only on other tasks' files (see Checks).

Files (new, my folders only; nothing committed):
- src/ui/Button/{Button.tsx,Button.css,Button.test.tsx,index.ts}
- src/ui/IconButton/{IconButton.tsx,IconButton.css,IconButton.test.tsx,index.ts}
- src/ui/Spinner/{Spinner.tsx,Spinner.css,Spinner.test.tsx,index.ts}
- src/ui/InlineMessage/{InlineMessage.tsx,InlineMessage.css,InlineMessage.test.tsx,index.ts}
- src/ui/Field/{Field.tsx,Field.css,Field.test.tsx,TextField.tsx,NumberField.tsx,NumberField.test.tsx,FrequencyField.tsx,FrequencyField.test.tsx,Select.tsx,Checkbox.tsx,index.ts}

Props as built:
- Button: variant 'default'|'primary'|'destructive', size 'default'|'small', busy, unavailable, icon, ref, + native button attrs. type defaults to "button".
- IconButton: label (required, aria-label), variant 'ghost'|'filled', unavailable, + native attrs.
- Spinner: label?, + span attrs. Glyph always aria-hidden; root aria-hidden only without label.
- InlineMessage: variant 'hint'|'note'|'info'|'warn'|'error' (default hint), + p attrs.
- Field: label, layout 'inline'|'stacked' (default stacked), id?, hint?: string, error?: string, children: (FieldControl{id, describedBy, invalid}) => ReactNode, + div attrs. Hint/error ids are `<id>-hint` / `<id>-error`.
- TextField: value, onChange(string), invalid?, size 'toolbar'|'compact', + input attrs.
- NumberField: value, onCommit(n), min, max, step?, integer?, label, unit?, size?, invalid?, + input attrs.
- FrequencyField: value, onCommit(hz), min?, max?, step? (1000), label, title?, size?, invalid?, + input attrs.
- Select: value, options {value,label,disabled?}[], onChange(string), label, size?, + select attrs (aria-describedby native).
- Checkbox: checked, onChange(bool), label, adornment?, disabled?, + input attrs (forwarded to the input; the label is the 24px target).

Tests: 82 across 8 files (variants, class sizes, CSS contracts for 24px/token rules via src/test/css rule(), unavailable ignores click and keeps focus, Enter/Space, busy keeps label, ARIA name/describedby/aria-invalid, NumberField/FrequencyField commit rules incl. Enter/blur/Escape/arrows/clamp).

Deviations (all deliberate, please check):
1. Button busy: spinner replaces the leading icon, or is added as a leading slot when there is none. Label is kept, but a label-only button grows by the slot width when busy. DESIGN 4.1 says width unchanged; I did not reserve space for it. Needs a decision if QA flags it.
2. NumberField Enter keeps an invalid entry visible (DESIGN 4.4), where NumberInput reverted it. NumberField also adds ArrowUp/Down stepping (NumberInput had none).
3. Escape bug in the old FrequencyInput (verified in a scratch probe, deleted): Escape on a valid draft commits it, because blur() reads a stale closure. Both new fields read the draft from a ref, so Escape reverts. Test asserts this. T7 should wire FrequencyField and drop FrequencyInput.
4. Unit lives on NumberField only (not on Field), so a single rendering path. Plan table listed unit on both.
5. Select takes aria-describedby natively, not a describedBy prop (Field's render function supplies it).
6. Field defaults to layout 'stacked'.

Checks:
- vitest (my folders + boundary.test.ts): 82/82 pass.
- eslint on my folders: clean (--max-warnings 0). prettier: clean on the whole repo.
- tsc: no error in my files. Errors elsewhere: src/ui/Dialog/Dialog.test.tsx (unused createRef), src/ui/Popover/Popover.tsx:76 (FocusEvent not generic).
- npm run check: cargo fmt/clippy/test pass. check:web stops at lint on other tasks' files: Dialog.test.tsx:3 unused createRef; Popover.tsx:81 unsafe relatedTarget; SplitButton.test.tsx:71 async without await. Full vitest: 449 pass, 1 fails: src/styles/tokens.test.ts "defines every token referenced" on src/ui/SplitButton/SplitButton.css (--split-fill, --split-ink, --split-divider, --split-fill-hover, ...), T5's file. Not fixed, per scope.

Left undone: no e2e or screenshot (unwired). No docs touched (src/ui/README and DESIGN 4 are not mine). No new dependency.
