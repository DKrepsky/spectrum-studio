---
id: 0201
from: developer
to: product-manager
type: handoff
subject: T9 finish: after-shots compared; full e2e not green in one run (flakes listed)
work: 009-design-system
reply-to: 0199
date: 2026-11-16T21:17:42-03:00
---

T9 finish. Code is done (see the staff-engineer handoff 0200 for files and checks). Summary for acceptance:

Checks: npm run check EXIT 0. Full e2e: NOT green in any of three full runs. Each run had one to three reds, all flaky and each passing alone at least once. Details are in 0200. The one that recurs (source-row ArrowRight focus check) was recorded as a pre-existing red in 0192. The stale-element reds (edit-source, migration-dup) have no before-code proof. visual.e2e.ts 47/47 in two runs, including the new hover test (the old known red is green).

Shots: evidence/after-T9/ (118 PNGs). Before: evidence/before/. Pixel diff is no use: every window shot differs in the live plot and status bar, so I compared popover crops by eye. Side-by-side 2x crops (left before, right after): evidence/compare-T9/ (typical menu 1180 and 1024, undo toast 1440, keyboard focus 1440, hover actions 1180, failed row 1180).

Every visible difference in the popover:

Intended (F2 / B1 / ruling 0198):
1. Badge sits on the row's name line (line 1), not centred on the whole two-line row. Every two-line row. Intended by DESIGN 4.11.
2. Hover and focus actions: before they sat on line 2 under the name; after they are two 24x24 buttons centred vertically in the 64px badge column, and the badge fades to 0 while they show. Intended (ruling 0198). Settled state checked in row-actions and hover shots.
3. Popover roles and structure: no visible change (menu roles gone, dialog named Sources; not visual).
4. Failed row: "Failed · /dev/ttyACM6" and the red cross unchanged (same content and place).
5. Long names: ellipsis unchanged, full name in the tooltip.

Expected from the migration, please confirm:
6. Undo button: before blue text with a blue border; after the ui secondary Button (grey text, light border). The toast text sits at the same left edge as before. Undo toast height unchanged.

Not intended, need a decision (I did not fix these):
7. Row pitch 47px before, 44px after (six rows at 1024 and 1180: 94px vs 88px per two rows in the crop). The legacy list had about 3px between rows; ListRow has none. The popover is about 20px shorter with six rows. DESIGN 4.11 says the row is 44px "the same as before", which is true for the row box but not for the pitch. Decide: add a 3px gap between rows (cheap, keeps the old look) or accept the tighter list and update DESIGN 4.11.
8. "No new devices found. Plug one in; this list updates automatically." sits about 8px left of the "DETECTED DEVICES" heading (note at x 145, heading at x 154 at 1180). Before, the note was indented to the heading's text plus about 4px. This is a regression from the migration; the fix is an inset on the note in the popover group. Not fixed here (visual change, needs designer's word on the inset).
9. Content (names, status dot, badges) about 2px further left and the top heading about 2.5px higher, from popover padding. Minor, probably accept.

Not comparable, or not captured:
10. Keyboard-focus shot (menu-keyboard-focus, 1024 and 1440): not a valid comparison. The pointer still rests on the row just clicked (Undo), so that row shows its hover actions mid-transition over its USB badge. The focus ring on the first row is not drawn in either shot (window focus, see memory). The settled hover state is clean (hover-actions shot). The transition overlap is 150 ms.
11. Undo toast 1024: same as 1440 (not separately cropped).
12. No before shot exists at 1440 for the typical menu, the popover or the connect form. The connect form in the popover (SourceForm view) has no shot in either set and needs a detected device with required parameters, which the seeds do not have. Not compared.
13. Other full-window shots (capture, statusbar, panels, toolbar, dialogs, banners) differ only in live content (plot, status bar counters, frame number). Not compared pixel by pixel.

Open for you:
- docs/roadmap.md line 40 still lists the hover-actions defect as open. T9 resolves it. Not edited by me.
- .prettierignore: added .claude/team/work/**/measure/ (designer's measure HTML failed prettier --check). Config change.
- Decide items 7 and 8 before acceptance.
