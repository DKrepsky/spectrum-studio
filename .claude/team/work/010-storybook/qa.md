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

---

## Rework 2 (re-verification after developer handoff 0255, uncommitted tree)

Verdict: **SHIP** (the three follow-ups are fixed and verified; the open items below are decisions for the PM, not defects). Scope: the three follow-ups, the Dialog markup change, and the checks. Scratch artefacts (probe, raw logs) are in the QA scratchpad; the probe spec was temporary and is not in the tree.

Screenshots: `screenshots/` (Storybook: `badge-*`, `menu-*`, `dialog-*`, `popover-*`, `a11y-panel-*`; app: `app-*`). Storybook shots come from a static build of this tree (`storybook-static/`) served on a QA port, captured with headless Chrome; app shots come from the real Tauri debug binary (WebKitGTK via WebDriver) and, for the real-hardware set, with the SA430 on `/dev/ttyACM0`.

### Criteria

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| R2-1 | Badge long text: one line, ellipsis inside the pill, full text as native `title` only when cut, accessible name is the full text | **PASS** | Storybook `ui-badge--chip-long-text` measured: pill 140px, label scrollWidth 313 > clientWidth 124, `overflow:hidden`, `text-overflow:ellipsis`, `white-space:nowrap`, `title` = full text, textContent = full text. Shot `badge-chip-long-text-420-long.png` (reads "Serial over USB CDC-..."). Short chips: `Built-in` (`badge-chip-in-column-420-builtin.png`, 55px pill, no title, label not cut), `USB` (`badge-chip-420-usb.png`, no title), tag `LIVE` (`badge-tag-live-420-hold.png`, no title). Unit test block in Badge.test.tsx reviewed: asserts the CSS, the title when cut, no title when it fits, caller title wins. |
| R2-1a | Short app badges (Built-in, USB, HOLD) unchanged in the app | **PASS** | Real Tauri build, visual spec: `app-capture-menu-open-1180.png`, `app-row-actions-1180-long-name.png`, `app-failed-row-1180-long-name.png` (Built-in and USB 64px badges in one column), `app-typical-menu-1180-seeded-real-sa430.png` (real SA430 row "SA430 08FF41E50F8B3A34", USB badge), `app-statusbar-hold-1180.png` (HOLD tag). Visual guard (64px badge column, equal left edges, line 2, row heights) passes at 1180 and 1024 in both runs. |
| R2-1b | App: 60-char source name row | **PASS** | `app-row-actions-1180-long-name.png`, `app-failed-row-1180-long-name.png`: name ellipsised with a full-name `title` (guard), badge intact at right, hover actions replace the badge in its column (`app-hover-actions-replace-badge-1180-long-name.png`). |
| R2-2 | Menu item without icon keeps the 18px icon column; name, description and check aligned | **PASS** | `menu-no-icon-720-na.png` (Continuous/Single, no icon, names at x=58 px, descriptions and check on the same grid); `menu-default-with-icons-720-na.png` (icons present, same name x). `menu-no-description-720-na.png`, `menu-long-name-720-long.png` (3-line wrapped name, icon top-aligned, check at right): ok. CSS: `.menu-item-icon:empty { display:none }` removed; Menu.test.tsx asserts the empty cell exists and no display:none rule (with a self-check). |
| R2-2a | Menus with icons unchanged in the app | **PASS (by eye and guard)** | `app-capture-menu-open-1180.png` (icons and check on the same grid), `app-narrow-menu-1024-seeded.png`; `app-menu-keyboard-focus-1024.png` is copied but not viewed by me. No pre-change pixel baseline was taken, so "unchanged" rests on the visual guard and by-eye comparison, not on a diff. |
| R2-3 | a11y add-on: panel shows in Storybook | **PASS** | `a11y-panel-menu-no-icon-1280-na.png` (Accessibility tab, Violations 0, Passes 18, Inconclusive 1), `a11y-panel-badge-long-text-1280-long.png` (Violations 0, Passes 4). The panel is in the manager UI of the static build; the dev server on 6006 is listening but I did not open it. |
| R2-3a | `npm test` fails on a new axe violation | **PASS (mutation)** | Appended `export const QaAxeViolation: Story = { render: () => <img src="qa-planted.png" /> }` to `src/ui/Button/Button.stories.tsx`; `npx vitest run src/ui/stories.test.tsx` exit 1: `image-alt (critical): Images must have alternative text; img` (1 failed, 133 passed). Restored; `cmp` identical to the backup. Log: scratchpad `qa2-mut-a11y.log`. |
| R2-3b | Per-story exemptions justified | **PASS (reviewed)** | Only one per-story exemption in the tree: Popover `BADGE_OUTSIDE_NAME` (`label-content-name-mismatch` off on Default, RowActions, LongName) with a comment, matching the PM's 2026-11-17 acceptance (row name = name and status, DESIGN 9.12; badge outside). Region is off globally, as in the addon. Dialog: `role="dialog"` moved to a div (aria-allowed-role), a plain `<button>` replaced by Button in three story wrappers (colour contrast, story-only), Popover LongName/RowUnavailable text fixed. No other `a11y` parameter in `src/ui`. |
| R2-4 | Dialog markup: looks the same, Enter submits, Escape closes, focus trap, SR name intact | **PASS** | Real app, WebDriver probe (temporary spec, removed afterwards): `role=dialog`, `aria-modal=true`, tag DIV, `aria-labelledby` resolves to "Add source", exactly one `form` inside with `display: contents`, no role on the form. Enter in the Name field with name + port: dialog closed (the save path; I did not re-check the menu row afterwards). Escape: dialog closed, focus back on `source-button`. Tab cycles name, driver, port, Cancel, Save, name (14 presses, all inside); Shift+Tab 4 presses, all inside. Shots: `app-add-dialog-empty-1180-seeded.png`, `app-add-dialog-failed-1180-long-port.png`, `app-add-dialog-ok-1180-real-sa430.png` (real device: Connection OK and "already in Your sources" warning, both in place), `qa-probe-dialog-open-1440-empty.png` (scratchpad). Storybook: `dialog-idle-720-stub.png`, `dialog-saving-720-stub.png`, `dialog-long-title-720-long.png`. |
| R2-4a | The "Source" legend that D3 reported is gone from the Dialog stories | **PASS** | `dialog-idle-720-stub.png` and `dialog-saving-720-stub.png`: no legend above "Name". |
| R2-4b | D2 (Menu story clipped) and O1 (Popover top clipped) | **PASS** | `menu-default-with-icons-720-na.png` and `popover-default-720-na.png` are fully in frame at 720px; the menu and popover no longer start at y=0 clipped. |
| R2-4c | D4 (busy Save: spinner only vs label) | **Closed as wording** | DESIGN.md 4.12 now says the label is kept transparent so the name stays (matches 4.1 and the shipped code). `dialog-saving-720-stub.png` shows the spinner alone in the green Save button, as specified. Design choice, not a defect. |
| R2-5 | `npm run check` | **PASS** | exit 0. Vitest 53 files / 666 tests passed; Rust: 225 tests passed, 0 failed across the workspace; fmt, clippy, eslint, tsc, prettier all ok. |
| R2-5a | `npm run build-storybook` | **PASS** | exit 0 (chunk-size warning only). |
| R2-5b | `npm run build` has no Storybook code | **PASS** | exit 0; `grep -ril storybook dist` = 0 matches. |

### E2E on the real debug binary (`npx tauri build --debug --no-bundle`, exit 0)

| Spec | Run | Result |
| --- | --- | --- |
| `visual.e2e.ts` | no hardware | 47 passing (1m 31s) |
| `visual.e2e.ts` | `SPECTRUM_E2E_SA430=1` (real SA430 on /dev/ttyACM0) | 49 passing, 1 skipped (the two-analyzer state, needs a second device; reported as skipped, not mocked) |
| `add-source.e2e.ts` + `edit-source.e2e.ts` | no hardware | 6 + 4 passing (hardware cases skipped without the variable) |
| `source-row.e2e.ts` | run 1 | 10 passing, 1 failing: "long name row: ellipsis with title, buttons centred and clear of the name" (`long-name row buttons not revealed on hover`) |
| `source-row.e2e.ts` | run 2 (isolated re-run, as the rule asks) | 11 passing |
| temporary probe (Dialog) | run 1 | 4 passing; removed from `e2e/` afterwards (`git status --short e2e` clean) |

The one `source-row` failure is the hover-timing flake already in the QA memory (moveTo, then a fixed 350 ms pause; buttons not yet revealed). It passed on the isolated re-run and in the previous two QA runs of this tree. Not a bug report yet. The developer's "Forget not interactable" failure of `visual.e2e.ts` did not recur in my three visual runs. Both are existing flake classes; #24 is the tracked one.

### Not run / limits

- Vite-only app capture: not done. Chrome against the Vite dev server shows the backend-error state, so the real Tauri binary was used instead.
- Full `npm run e2e`: not run; the specs above were run individually.
- `npm run tauri build` (bundles): not run; the debug `--no-bundle` build was run.
- Pixel diff of the menu against the pre-change HEAD: not run (no baseline build in this pass).
- Keyboard focus ring pixel measurement: not done (carried from pass 1).

### Open items for the PM (not blocking, from the handoff)

1. Accessible name of the Popover row (badge outside the name, rule off in three stories). Decision accepted; a change to ListRow `label` would change e2e names.
2. Dev-tree npm audit (24 moderate, Storybook 10 dependency chain; fix is a downgrade). Prod audit 0.
3. Residual risk: `source-row.e2e.ts` hover flake (1 of 3 runs of this tree).
