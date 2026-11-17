---
id: 0252
from: qa
to: product-manager
type: report
subject: 010 QA: #36 verdict DON'T SHIP YET
work: 010-storybook
reply-to: 
date: 2026-11-17T01:42:26-03:00
---

# QA 010-storybook (issue #36)

Tree: uncommitted working tree at /home/kr/workspace/spectrum-kit. Storybook 10 dev server on :6006 (already running, started by someone else; not touched). Vite dev server on :1420 (already running; not touched). No Tauri window was opened (see criterion 3).

Method: Storybook static and dev pages captured with headless Google Chrome through the DevTools protocol (scratch script, computed styles read in-page). Contact sheets built with PIL. Every raw shot is in `screenshots/evidence/` (gitignored).

## Verdict: DON'T SHIP YET (2 visual defects, 1 story defect, criteria 3 only partly run)

Criteria 1, 2 (with a caveat), 5, 6 pass. Criterion 4 passes. Criterion 3 is partial: no Tauri window, Vite-only comparison. Defects are below.

## Criteria

| # | Criterion (issue #36) | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `npm run storybook` lists every `src/ui` component | **PASS** | `curl localhost:6006/index.json`: 107 story entries, 17 titles = 16 `src/ui` folders with `index.ts` (Badge, Banner, Button, Dialog, Field, IconButton, InlineMessage, LiveRegion, Menu, Popover, Section, Spinner, SplitButton, StatusDot, StatusStrip, Table) plus `Design system/Tokens`. Each folder has `<Folder>/<Folder>.stories.tsx` (checked with a loop). Note: `hooks/` has no index.ts and no stories, as planned. |
| 2 | Each component's supported states have stories | **PASS with caveats** | Story sets cover default, variants, focus (play), unavailable, busy, error, long text, open overlays per DESIGN.md 4 as the developer listed. Caveats: hover and active cannot be shown without a pseudo-state addon (accepted by the ADR, not a gap in the list); Field stories cover Field/TextField/NumberField/FrequencyField/Select/Checkbox. I did not diff every prop against every story by hand. |
| 3 | Story colours, fonts and spacing match the app | **PARTIAL** | Computed style compared for the split button (story `.split-main` vs app `split-main`): both 13px, background rgb(62,224,181), height 30px, same font stack `Inter, Cantarell, Ubuntu, system-ui, sans-serif`. Screenshots: `screenshots/app-vite-toolbar-1440-nodata.png` (app, Vite only, backend error banner expected) and `screenshots/sb-splitbutton-continuous-720-stub.png`. Not run: the real Tauri app (no WebKitWebDriver on PATH, see "Not run"). Menu and Dialog could not be compared to the app because the app's capture chevron and Add-source flow need a backend. |
| 3a | `sb-dialog-saving.png`: busy Save shows only a spinner, no label | **Not a story gap; a design question (see D4)** | Shipped code: `SourceDialog.tsx` renders `<Button busy>Save</Button>` with no icon, so the label is masked (`ui-button__label--masked`, transparent) and the overlay spinner shows. DESIGN.md 4.1 specifies exactly this ("overlays a label-only button with the label painted transparent so its name stays"). DESIGN.md 4.12 says "Save is busy: ... with its spinner and label". The two sentences disagree. The story label "Saving…" is invisible for the same reason, which matches the app. Shot: `screenshots/sb-dialog-saving-720-stub.png`, `screenshots/sb-button-busy-720-stub.png`. |
| 3b | Stray "Source" line above "Name" in the Dialog stories | **Defect in the story (D3)** | The stories wrap fields in `<FieldGroup legend="Source">`. The app's SourceDialog and SourceForm never use `FieldGroup` (grep: no usage in `src/components`). So the "Source" line is a story composition error, not app behaviour. Shot: `screenshots/sb-dialog-saving-720-stub.png`, contact sheet `screenshots/sheets/sheet-UI_Dialog.png`. |
| 3c | Long text | **FAIL for Badge (D1); observation for Table** | Badge "Chip Long Text": the chip is 140px, its scrollWidth is 321px, `white-space: nowrap`, overflow visible. The text runs out of the pill. Shot `screenshots/sb-badge-chip-long-text-720-stub.png`, zoom `screenshots/sb-badge-chip-long-text-720-zoom.png`. Table "Long Text" wraps the Level cell so "dBFS" falls onto a second line (no ellipsis); see O2. Banner, InlineMessage, Button long label, Dialog long title, Section long title render without overflow in the sheets. |
| 3d | Focus ring | **Partial** | Focus stories exist (Button, IconButton, Field, Section, SplitButton, Checkbox). At contact-sheet scale the ring is not clearly visible in the Button focus shot; I did not measure the outline box. Not verified. |
| 3e | Tokens page scrolls | **PASS** | `scrollHeight` 4406 with innerHeight 480 at the top; at the end `scrollY` 3926 equals the max (`screenshots/sb-tokens-top-720-stub.png`, `screenshots/sb-tokens-end-720-stub.png`). |
| 3f | Every screenshot looked at | **Partial** | Looked at, by eye: Button, Dialog, Table, Popover, SplitButton, Menu (plus a full-size Menu shot), Field, Banner, StatusStrip, Badge contact sheets, the tokens top and end shots, the app toolbar shot. Not looked at individually: InlineMessage, LiveRegion, StatusDot, Spinner, Section, IconButton (their 720px raw shots exist in `evidence/`, contact sheets were built but not reviewed). Not run: 1024/narrow widths for stories, and real hardware data. |
| 4 | Tokens page shows colours, type scale, spacing from tokens.css | **PASS** | Palette swatches with names and hex (`sheets/sheet-Design_system_Tokens.png`, `screenshots/sb-tokens-top-720-stub.png`), Spacing bars (`--space-1` 2px ... `--space-7` 24px) and Radius (`--radius-xs` 2px ... `--radius-round` 50%) in `screenshots/sb-tokens-end-720-stub.png`. Type scale section exists (heading list from the page: Palette, Colour (semantic), Type scale, Spacing, Radius). I did not read the type-scale section by eye. |
| 5 | `npm run check` fails when a stories file is removed or a story throws | **PASS (checked on `npm test`, which is the part of `check` that runs the guard)** | Mutation 1: removed `src/ui/Badge/Badge.stories.tsx`, `npx vitest run src/ui/stories.test.tsx` failed: `no <Folder>/<Folder>.stories.tsx for: Badge` (1 failed, 121 passed). Restored; `cmp` identical. Mutation 2: appended `QaBrokenRender` (render throws "qa boom") to `Button.stories.tsx`: 1 failed, 130 passed, error "qa boom". Restored; `cmp` identical. Both files are untracked, so `git diff` cannot show them; the byte comparison is the proof. The full `npm run check` was not rerun by me (the developer reports it green); `npm test` is run inside `check:web`. |
| 6a | `npm run build-storybook` succeeds | **PASS** | exit 0, chunk-size warning only. Output `storybook-static/` (git-ignored). |
| 6b | `npm run build` output has no Storybook code | **PASS** | `npm run build` exit 0; `grep -ril storybook dist` = 0 matches. |
| 6c | `npm run storybook` and `npm run tauri dev` run at the same time | **PASS (bind only)** | `ss -ltnp`: 127.0.0.1:6006 (storybook dev) and 127.0.0.1:1420 (vite, tauri's beforeDevCommand) both LISTEN together. `tauri dev` window not opened (no GUI check). |
| 6d | `npm run tauri build` contains no Storybook code | **Not run** | Only `npm run build` was run. Source-level guard (`storybook` boundary test) passes in `npm test`; the release bundle was not built. |

## Defects

### D1 (medium, visual): Badge chip text overflows its chip
- Story: `UI/Badge` / "Chip Long Text" (`ui-badge--chip-long-text`).
- Measured: `.ui-badge` width 140px, scrollWidth 321px, `white-space: nowrap`, `overflow: visible`, no ellipsis and no title. The text "Serial over USB CDC-ACM, bench unit 08FF41E50F8B3A34" escapes the pill.
- Expected per the visual checklist: ellipsis with the full name on hover/title, or wrap; nothing overflows its container.
- Evidence: `screenshots/sb-badge-chip-long-text-720-stub.png`, `screenshots/sb-badge-chip-long-text-720-zoom.png`, `screenshots/evidence/sb-ui-badge--chip-long-text-720-stub.png`.

### D2 (medium, visual): Menu story is clipped and its items overlap
- Story: `UI/Menu` / "Default" and "Long Name", "No Description".
- Seen: the menu is cut off at the top and bottom of the frame (its anchor sits at the top of the story, so the menu opens above the viewport); the description "Frames until stopped" wraps word by word in a narrow column; the check glyph sits on top of the "Continuous" label.
- Not yet established whether this is the story wrapper (anchor at y≈0, width var(--popover-width-mode)) or the component. The app's capture menu needs a connected source, which I could not get without Tauri. Filing as a bug to be confirmed by the developer in the real app.
- Evidence: `screenshots/sb-menu-default-720-stub.png`, `screenshots/sheets/sheet-UI_Menu.png`.

### D3 (low, story): Dialog stories show a "Source" legend that the app does not show
- Every Dialog story wraps its fields in `FieldGroup legend="Source"` (or "Connection" in Testing). `SourceDialog` and `SourceForm` never render a FieldGroup. The stories therefore show a UI the app does not have.
- Fix belongs in `src/ui/Dialog/Dialog.stories.tsx` (developer). Evidence: `screenshots/sb-dialog-saving-720-stub.png`, `screenshots/sheets/sheet-UI_Dialog.png`.

### D4 (question, not a bug yet): busy Save shows only a spinner
- Matches the shipped code and DESIGN.md 4.1. Conflicts with DESIGN.md 4.12 ("with its spinner and label"). A sighted user sees a bare 12px spinner glyph in a primary button while saving. Needs a decision from the designer or PM: keep the masked label (4.1) or show the label next to the spinner (4.12). Not filing as a defect; raised in the report.

### O1 (observation): Popover stories are positioned at the top of the frame and clipped
- Several Popover stories (Default, Row Actions, Row Highlight) start at y≈0 with the top edge cut. Same root as D2 (story anchor placement). Shares the fix with D2.

### O2 (observation): Table long text wraps instead of truncating
- "Long Text" wraps the Level cell ("-41.2" / "dBFS" on two lines). Acceptable if intended; DESIGN.md does not say which. Evidence: `screenshots/sheets/sheet-UI_Table.png`.

## Not run (and why)

- Real Tauri app and the real SA430 (`/dev/ttyACM0` is present): WebKitWebDriver is not on PATH (`tauri-driver` exists in `~/.cargo/bin`; `webkit2gtk-driver` must be extracted from apt without root, see memory). Not done in this pass, so no real-hardware screenshots and no app-side comparison of Menu, Dialog or busy states.
- Stories at narrow widths (400px and below) and 1024px: only 720px was captured. The developer's `sb-statusstrip-narrow` shot exists.
- Keyboard focus ring measurement: not measured by pixel.
- Remaining contact sheets (InlineMessage, LiveRegion, StatusDot, Spinner, Section, IconButton): built, not reviewed by eye.
- `npm run check` full run (rerun by me): not run; `npm test` with the two mutations was run.
- `tauri build`: not run.

## Developer screenshots (inherited)

`screenshots/sb-*.png` (developer, 14 files) and `screenshots/app-toolbar-reference.png` were not re-verified by me except `sb-dialog-saving.png` (same content as my 720 shot, with the Source line) and the split-button state in my own shot.

## Artifacts

- Contact sheets: `screenshots/sheets/*.png`
- Raw 720px captures for all 107 stories: `screenshots/evidence/sb-<story-id>-720-stub.png`
- Tokens: `screenshots/sb-tokens-top-720-stub.png`, `screenshots/sb-tokens-end-720-stub.png`
- Vite app toolbar: `screenshots/app-vite-toolbar-1440-nodata.png`
