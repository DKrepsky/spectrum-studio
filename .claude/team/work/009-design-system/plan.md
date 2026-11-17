# 009 Design system: implementation plan

Author: staff engineer, 2026-11-16. Inputs: story.md, decisions.md (final scope), `/DESIGN.md`
1.0-draft.2, design.md, the code on `main`. ADR: `docs/adr/0015-ui-feature-boundary-and-design-tokens.md`.
Scope is exactly decisions.md "Scope of 009 (final)". No backend change, no new dependency, no
`npm run bindings` impact (no Rust type changes).

## 1. Approach in one paragraph

Land the token file and the guards first (no visible change). Build the `src/ui/` components in
parallel, unwired, each with tests. Then migrate feature areas one at a time onto them, deleting
the legacy CSS each area owned; the proposed fixes (F-items) become visible when a component is
wired. Finish with cleanup (remove the legacy cascade layer, tighten guards), docs, and QA's
after-screenshots. Behaviour changes in scope (B1, B2, B7, F0, C1) ride with the migration task
that owns the file.

## 2. Target structure

```
src/
  styles/
    tokens.css            single token source = DESIGN.md Appendix A (+ alias block, + @layer order)
    tokens.test.ts        token tests (defined, literals, contrast, canvas map, Appendix A equality)
    app.css               base + page layout only (html/body, .app, .workspace, .plots, .plot, ...)
    capture.css, source.css, sourceDialog.css   shrink and disappear as areas migrate
  ui/
    boundary.test.ts      import + formatting guard for src/ui/**
    hooks/                useFocusTrap, useMenuKeys (moved), useListKeys (new), useDismiss (new)
    Button/ IconButton/ SplitButton/ Spinner/ InlineMessage/
    Field/                Field, TextField, NumberField, FrequencyField, Select, Checkbox
    Badge/ StatusDot/ Banner/ (Banner, BannerRegion) LiveRegion/ Section/ Table/ StatusStrip/
    Popover/              Popover, PopoverGroup, ListRow
    Menu/                 Menu, MenuItemRadio
    Dialog/               Dialog, DialogFooter, FieldGroup
      each: <Name>.tsx  <Name>.css  <Name>.test.tsx  index.ts
  components/             feature containers only (see 4)
  plot/theme.ts           getPlotTheme() reads tokens at runtime
  test/tokens.ts          parseTokens()/resolveToken() helper over tokens.css (tests only)
  test/css.ts             rule() helper that tolerates @layer/@media nesting (replaces local copies)
```

Layout choice and why: one folder per component (about 20 components x 3 files would be unreadable
flat; families that share CSS share a folder), co-located CSS (a component owns its styling and is
deleted/moved as one unit), no barrel (parallel tasks would conflict on it; imports stay explicit).
CSS entry: components `import './X.css'`; `main.tsx` imports `tokens.css` then `app.css` then the
remaining feature CSS. jsdom/Vitest ignores CSS imports; contract tests read the files with `fs`.

## 3. Tokens: one source, four consumers

| Consumer | Mechanism |
| --- | --- |
| `tokens.css` | Verbatim DESIGN.md Appendix A. Test `tokens.test.ts` extracts the fenced block under "Appendix A" from `/DESIGN.md` and compares it with the file (whitespace-normalised). Edit both or the test fails. |
| CSS | `var(--semantic-token)`. Literal guard in `tokens.test.ts` (DESIGN.md 2.17 allow-list); guard starts with a shrinking `LEGACY_FILES` list that T11 empties. |
| React | Class names only. No colour/size literal in TSX (inline style only for plot-geometry values). |
| Canvas | `getPlotTheme()` in `src/plot/theme.ts`: builds the `PLOT_THEME` object from `getComputedStyle(document.documentElement)` on first call, caches, throws `Error('missing token --x')` on empty. Signature `getPlotTheme(read = defaultRead)`; `read(name)` injectable. Fonts built as `${--font-size-xs} ${--font-family-ui}`. `PLOT_INSETS` stays a constant. Reset hook `resetPlotTheme()` for tests. |
| Tests | `src/test/tokens.ts` parses `tokens.css` (custom properties, resolving `var()` chains) and serves as the injected `read`. jsdom neither loads stylesheets nor substitutes `var()`, so computed styles are never used in tests. |

Why runtime read and not a generated TS module: single copy, no build step, nothing to drift
(ADR 0015). Why lazy (first draw) rather than module start: `main.tsx` imports CSS before the first
render, but unit tests import renderers without a stylesheet; lazy plus injectable keeps both
working and keeps a missing token an error, not a fallback.

Alias block (DESIGN.md 2.19): kept in `tokens.css` so unmigrated CSS keeps working during the work;
migrated CSS uses only semantic names. `--warn-strong` is dropped (F12).

## 4. What lives where

### `src/ui/` components (props: presentational only; all forward native attributes and `data-testid`)

Types are declared in `src/ui/`; no `bindings`, state or IPC types.

| Component | Props (essential) | Replaces |
| --- | --- | --- |
| `Button` | `variant: 'default'\|'primary'\|'destructive'`, `size: 'default'\|'small'`, `busy?`, `unavailable?` (aria-disabled, click ignored, keeps focus; native `disabled` still works), `icon?`, native button props | `button`, `.primary`, `.small`, `.forget`, `.button-row` buttons |
| `IconButton` | `label` (required, becomes `aria-label`), `variant: 'ghost'\|'filled'`, `children` glyph, `title?` | `button.icon`, notice dismiss, marker x, row actions |
| `SplitButton` | `tone: 'accent'\|'violet'\|'danger'`, `groupLabel`, `main: {label, icon, onPress, unavailable?, disabled?, describedBy?, title?}`, `chevron: {label, expanded, onPress, disabled?, unavailable?, describedBy?, title?}`, `mainRef`, `chevronRef`, `children` (popover slot) | `.capture`, `.capture-main`, `.capture-chevron` markup in `CaptureControl` |
| `Spinner` | `label?` | `.spinner` |
| `InlineMessage` | `variant: 'hint'\|'note'\|'info'\|'warn'\|'error'`, `id?`, `children` | `.hint`, `.help`, `.dlg-note`, `.error`, `.err`, `.dlg-error` |
| `Field` | `label`, `layout: 'inline'\|'stacked'`, `unit?`, `hint?`, `error?`, `children: (a: {id, describedBy, invalid}) => ReactNode` | `.form-row`, `.param-field`, `.field`, `.with-unit`, dialog rows |
| `TextField` | `value`, `onChange(value)`, `invalid?`, `readOnly?`, native input props | `input[type=text]` |
| `NumberField` | `value`, `onCommit(n)`, `min`, `max`, `step?`, `integer?`, `label`, `unit?`, `disabled?`, `id?` (commit rules of DESIGN.md 4.4) | `NumberInput` |
| `FrequencyField` | `value`, `onCommit(hz)`, `min?`, `max?`, `step?`, `label`, `title?`, `size?: 'toolbar'\|'compact'` (imports `src/format/frequency`) | `FrequencyInput`, `.freq-input` |
| `Select` | `value`, `options: {value,label,disabled?}[]`, `onChange(value)`, `label`, `size?`, `disabled?`, `describedBy?` | raw `select` |
| `Checkbox` | `checked`, `onChange(checked)`, `label`, `adornment?`, `disabled?` (label is a 24px target, F14) | `.form-row.checks label` |
| `Badge` | `variant: 'chip'\|'tag'`, `tone?: 'neutral'\|'live'\|'waiting'\|'warn'\|'capturing'`, `children` | `.badge`, `.src-badge`, `.plot-badge` |
| `StatusDot` | `status: 'connected'\|'acquiring'\|'connecting'\|'disconnecting'\|'failed'\|'absent'\|'idle'` (visual vocabulary; `aria-hidden`) | `StatusGlyph`, `.src-dot`, inline dot span |
| `Banner` | `tone: 'warning'\|'error'`, `urgency: 'alert'\|'status'` (role), `actions?`, `onDismiss`, `dismissLabel?`, `children` | `.notice*` markup |
| `BannerRegion` | always-mounted polite live container for banners (DESIGN.md 9.6) | new (B2) |
| `LiveRegion` | `message` (visually hidden, always mounted) | `.visually-hidden` + status |
| `Section` | `title`, `open?`, `children` (native `details`) | `Section` in `SidePanel`, `.panel` |
| `Table` | `label`, `columns`, `rows: {key, active?, onSelect?, cells: ReactNode[]}[]`, `emptyText` | `.readout-table` markup |
| `StatusStrip` | `items: {id, label?, value, title?, dropOrder?: number}[]` (items without `dropOrder` are pinned), `empty?: ReactNode`; measures and drops whole items, lowest `dropOrder` first, until it fits (DESIGN.md 3.4, F0) | `.status-bar` internals |
| `Popover` | `label`, `anchorRef`, `onClose(refocus: boolean)`, `initialFocus?: 'selected'\|'first'`, `width?: 'source'\|'mode'`, `children`. Non-modal `role="dialog"`: Escape closes+refocus, outside press closes, Tab/Shift+Tab leave and close without refocus, Up/Down between rows via `useListKeys`. No type-ahead (Q-18). | `.source-popover`, `.mode-popover` |
| `PopoverGroup` | `heading`, `children` | `.source-heading`, `.mode-heading` (one style, E5) |
| `ListRow` | `selected?` (`aria-current`), `unavailable?`, `onSelect`, `leading?`, `name`, `statusText?`, `badge?`, `detail?`, `actions?: ReactNode`, `title?` | `.source-item` row |
| `Menu` / `MenuItemRadio` | `Menu`: `label`, `heading`, `onClose(refocus)`, `children`. `MenuItemRadio`: `checked`, `icon`, `name`, `description`, `onSelect`. `role=menu`, type-ahead kept (DESIGN.md 4.11). | `CaptureModeMenu` markup |
| `Dialog` | `title`, `onClose` (Escape), `returnFocusTo`, `busy?`, `describedBy?`, `children`, `footer` (portal, backdrop, focus trap, `aria-modal`) | `.dialog-backdrop`, `.source-dialog` shell |
| `FieldGroup` | `legend`, `children` (fieldset, F11) | `.param-group` |
| `hooks/` | `useFocusTrap` and `useMenuKeys` moved from `components/source/` (pure DOM, no state); `useListKeys` (Up/Down/Home/End over `[data-list-item]`), `useDismiss` (outside press) | |

Deliberately not in `src/ui/`: Toolbar (layout of this app), Tooltip (deferred), anything that
knows a mode name, a unit, a source or a session state. `useCanvasSize` stays in `components`
(canvas helper, may move later).

### `src/components/` stays (feature containers)

`Toolbar`, `StatusBar` (builds the item list from the frame and passes `dropOrder`), `SidePanel` and
`panels/*`, `ParamForm` (maps `ParamSpec` to ui fields), `NoticeBanner` (maps `SessionNotice` to
`tone`/`urgency`/actions), `capture/CaptureControl` (maps session to `SplitButton`) and
`CaptureModeMenu` (items data + `Menu`), `source/*` (`SourceButton`, `SourceMenu`, `SourceForm`,
`SourceDialog`, `status.tsx` keeps `EntryStatus` mapping and passes `StatusDot` a `status`),
`SpectrumView`, `WaterfallView`, `useCanvasSize`, `menuState.ts`. `NumberInput.tsx` and
`FrequencyInput.tsx` are deleted (T6/T7) in favour of `NumberField`/`FrequencyField`.

## 5. Cascade and global element rules

`app.css` lines for `button`, `input`, `select`, `.freq-input`, focus and disabled rules move into
`@layer legacy-controls { ... }` in T1 (no visual change expected; QA smoke screenshot). Ui CSS is
unlayered so it wins regardless of specificity. T11 deletes the layer and what remains of it.
Known risk: a legacy class rule with lower specificity than a legacy global hover rule changes
winner when the global moves to the layer (e.g. hover on a legacy-classed button). T1 must
screenshot hover states of capture main/chevron, mode item, source row, `.primary` and `.small`
buttons before/after and fix any difference inside the legacy classes.

## 6. Boundary guard

1. ESLint: `eslint.config.js` override `files: ['src/ui/**/*.{ts,tsx}']` with
   `no-restricted-imports` patterns `**/ipc/**`, `**/state/**`, `**/bindings/**`, `**/plot/**`,
   `**/components/**` plus `paths`/patterns for `@tauri-apps/*`, `zustand`. Message names ADR 0015.
2. Vitest `src/ui/boundary.test.ts`: reads every file under `src/ui/` (incl. tests), asserts no
   forbidden import specifier (static, dynamic, `vi.mock`), and no `toFixed`/`toLocaleString`.
   The test includes a self-check: a fixture string with a forbidden import must be detected.

## 7. Migration order and task graph

```
T0 baseline shots (e2e visual spec + QA run on main)        -> must finish before T1 merges
T1 foundation                                               -> everything
   |-- T2 canvas theme (E3)                  [parallel]
   |-- T3 ui: controls                       [parallel]
   |-- T4 ui: display + StatusStrip          [parallel]
   |-- T5 ui: overlays + SplitButton + hooks [parallel; moves 2 hooks, touches 3 import lines]
T3+T4 -> T6 side panel + forms (ParamForm, panels)
T3+T4+T5 -> T7 toolbar, capture, status bar, plot chrome
T4 -> T8 banners
T3+T4+T5 -> T9 source popover (B1)  -> T10 source dialog (after T6 for ParamForm, after T9 for DialogTarget type)
T6..T10 -> T11 cleanup + guards final + e2e green
T12 docs (starts after T1; finishes after T11)   T13 QA after-shots + docs image (after T11)
```

Overlaps (shared files; use worktrees and rebase, or sequence):
- `src/styles/app.css`: T1, T6, T7, T8, T11 (distinct hunks: panel/form/table; toolbar/status/plot;
  notice). Run T6, T7, T8 in separate worktrees and merge sequentially; trivial conflicts only.
- `src/components/source/*`: T5 (import path of moved hooks only), T9, T10. Sequence T5 -> T9 -> T10.
- `ParamForm.tsx`: T6 owns it; T9 (`SourceForm`) and T10 (`SourceDialog`) only consume it, so they
  start after T6 merges.
- `e2e/specs/*` and `e2e/specs/helpers.ts`: T0, T7 (F0 test), T9, T10 (selector updates), T11.
- `src/main.tsx`: T1 only (new CSS is imported by components).
Truly independent: T2, T3, T4, T5 (disjoint folders), T12 vs T2..T5.

## 8. Fix and decision map

| Item | Task |
| --- | --- |
| E1, E2, F12, alias block, token tests, literal guard | T1 |
| E3 (Appendix B) | T2 |
| F1 (field heights), F2 (24px small/icon), F9 (0.6), F14, F15, F8 (InlineMessage 12px), E4 geometry tokens | T3 (values in ui CSS), taking effect with T6/T7/T9/T10 wiring |
| F10, F5 (StatusStrip 11px), E5 (StatusDot, one `.waterfall-axis`), F0 mechanism (E6), B2 `BannerRegion` | T4 |
| F3, F4 (offset 1px), F6, F7, F11, E5 (one popover surface/heading), B1 components, E7 | T5 |
| F1 panel selects wiring, F14 and F15 wiring, F2 marker x buttons, Table | T6 |
| F0 wiring + 1024/1180/1257 regression test (jsdom with mocked sizes + e2e at 1024), F13 (zoom reset), C1 copy (status bar, plot hints), B7, F4 wiring, E4 `capture.css.test.ts` by token | T7 |
| B2 for notices, F10 wiring | T8 |
| B1 (+ Q-18), `source.css.test.ts` by token, E5 `.source-heading`/`.src-dot` removal, B2 for `SourceForm` | T9 |
| F6, F7, F8, F11 wiring, B2 for dialog errors | T10 |
| Remove legacy layer, `LEGACY_FILES` empty, alias-unused guard, `toFixed` guard | T11 |
| README link, architecture.md, guidelines.md, user-guide "Play", DESIGN.md section 12 statuses, roadmap backlog | T12 |
| Visual before/after, docs/images re-shoot, zoom check (Q-5) | T0, T13 (QA) |

## 9. Answers to open questions

**Q-11 (stale threshold).** Yes, the frame can carry the sweep time, and it should: add an optional
`sweepIntervalMs` to `FrameHeader` (the expected time between frames), set by the pipeline from the
source (SA430: measured sweep time reported by its driver, simulator: the pacer period). The header
is JSON inside the binary frame (ADR 0003), so an additive optional field is compatible; it needs a
bindings run and a Rust test. `liveness.ts` would use `max(2000, 3 x sweepIntervalMs)`. A
UI-only fallback (3 x observed inter-frame time) fails on the first frame. Not in 009: logged as a
bug candidate with this design in the roadmap backlog (T12).

**Q-13 (device without a serial / duplicate ids).** Already defined, by ADR 0010 decision 1: a
device without a serial gets `port:<port name>` as `deviceId` (explicitly unstable, labelled with the
port), and two ports reporting the same serial are both given `port:` ids so ids never collide;
matching and merging use `driverId + deviceId` (`store::same_identity`). The UI shows the backend's
identity and never invents one. No change in 009; DESIGN.md 5.2.3 should cite ADR 0010 (T12).

## 10. Risks

1. **Cascade surprises** while two systems coexist (section 5). Mitigated by the layer, the T1
   hover screenshots, and QA's before/after.
2. **B1 is a rewrite of the largest component and its 863-line test.** Keep behaviour tests that
   still apply (selection, row actions, locking, Undo, F2/Delete), rewrite role-based queries
   (`menuitem` becomes `button`), delete type-ahead tests. e2e helpers use roles/testids; check
   `e2e/specs/helpers.ts` and the source specs.
3. **F0 mechanism needs layout**, which jsdom lacks. `StatusStrip` takes a measurement function
   (default `getBoundingClientRect`/`scrollWidth`) that tests stub; the real behaviour is asserted
   in e2e at 1024px and by QA at 1180/1257. Fallback if `ResizeObserver` loops: CSS thresholds
   (DESIGN.md 3.4) with +20px margin.
4. **e2e selectors on classes** (`.src-dot`, `.source-dialog h2/.err/.dlg-note`, `.brand`): moved
   to `data-testid` in the task that changes them; each task greps `e2e/` for classes it renames.
5. **Visual drift**: components must reproduce today's pixels except the F-items. QA compares screens;
   developers compare against `prototype/` and attach a local before/after screenshot of the area
   they migrated to their report.
6. **`@layer` support** (WebKitGTK >= 2.36): satisfied by Tauri 2's requirement; T1 verifies in
   `npm run e2e`.
7. **Parallel merge friction** on `app.css`; keep hunks disjoint, rebase before merge.
8. **Contrast tests** transcribe DESIGN.md 9.3/9.4 pairs; a transcription error would fail a
   correct token. Source of truth for ratios is `measure/contrast_pairs.py` output.
9. Component count (about 25 exports) is larger than "Button/Panel": acceptable because every one
   replaces existing duplicated markup (DESIGN.md 10.2 rule 1); nothing speculative (no Tooltip,
   no EmptyState).

## 11. Test plan

- **Unit (Vitest), `src/ui/**`**: render, each variant/state, keyboard, ARIA name/role, `data-testid`
  forwarding, callbacks, unavailable ignores clicks and keeps focus, NumberField/FrequencyField
  commit rules (Enter/blur/Escape/step), StatusStrip drop order with stubbed widths, Popover
  Escape/outside/Tab behaviour, Menu keys incl. type-ahead, Dialog trap/Escape/return focus,
  BannerRegion always mounted.
- **Token tests** (`src/styles/tokens.test.ts`): section 3. **Canvas map** test in
  `src/plot/theme.test.ts` (every key resolves; missing token throws).
- **Boundary**: `src/ui/boundary.test.ts` + `npm run lint`.
- **Feature**: existing component tests keep passing; those tied to B1/B2/B7/F0/C1 are updated in the
  owning task. New: `StatusBar` shows `Uncalibrated` at 1024/1180/1257 (stubbed widths) and never
  drops Center/Span/Unit; `NoticeBanner` roles (alert only for deviceLost, acquisitionFailed,
  internal); source popover has no `menu`/`menuitem` roles and no type-ahead; `Toolbar` has no
  `role=toolbar`; chevron/main `aria-describedby` reason.
- **Contract tests** `capture.css.test.ts`, `source.css.test.ts` assert geometry by token name
  (`--capture-main-width` etc. defined in `tokens.css` and used in the rule).
- **e2e** (`npm run e2e`): existing suites stay green (selectors updated where classes go);
  new assertion at 1024px that the status bar contains `Uncalibrated` (T7); popover keyboard flow
  (Tab leaves and closes; Up/Down) (T9).
- **Visual (QA)**. Before shots on `main` before T1 merges (T0), after shots after T11, same
  tool (`e2e/specs/visual.e2e.ts`, `SPECTRUM_E2E_SHOTS=<dir>`), same seed. Screens/states (DESIGN.md
  10.4): source popover (rows, hover with actions, Undo toast, fixed items, connect form, 60-char and
  22-char names, `SA430 08FF41E50F8B3A34`); capture mode menu; Add/Edit dialog (idle, testing, test
  failed, locked, saving); capture control (idle teal, idle violet, acquiring red, single capturing,
  chevron unavailable, main unavailable, keyboard focus); each side-panel section incl. invalid field,
  unavailable select, peaks/markers tables; banners (warning, error, command, with Reconnect);
  status bar (live, no frame, no source, connecting; 1024/1180/1257/1440); plot tag states and
  zoom reset; widths 1440 and 1024; keyboard focus rings; `prefers-reduced-motion`. QA lists every
  difference and checks each is an F-item.
- **Manual** (QA): Ctrl+= / Ctrl+- zoom check (Q-5), report only.

## 12. Definition of done for the work item

`npm run check` and `npm run e2e` green; `src/ui/` guard active; no non-token literal left in CSS
(`LEGACY_FILES` empty); `NumberInput`, `FrequencyInput`, `StatusGlyph` and the legacy layer gone;
docs updated (T12); QA after-shots reviewed and docs image re-shot.
