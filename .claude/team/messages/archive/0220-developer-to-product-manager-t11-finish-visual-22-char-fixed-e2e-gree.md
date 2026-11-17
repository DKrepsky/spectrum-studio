---
id: 0220
from: developer
to: product-manager
type: handoff
subject: T11 finish: visual 22-char fixed, e2e green, dialog shots for review
work: 009-design-system
reply-to: 0218
date: 2026-11-16T23:25:03-03:00
---

T11 finish done (request 0218). Summary for acceptance:

- Visual 22-char red: root cause = a test click on a hover-only row action after the list moved under the pointer.
  Reproduced deterministically; fixed in the test helper (`clickRowAction`), not in the app. No assertion weakened.
  The app's row actions are unchanged. The trigger in the full run was not captured (rare).
- Acquisition single-capture: 3/3 isolated green, green in the full run.
- Orphan wdio runners 205983 and 208169 (for the deleted t10-shots spec) are not mine and still running; they hold no
  port 4444. Left alone; you may want to end them.
- `npm run check` green; `npm run e2e` green in one run (11/11 spec files, visual 47/47).
- Dialog shots: .claude/team/work/009-design-system/evidence/after-T11/ and side-by-side crops (T10 left, T11 right)
  in evidence/compare-T11/. Checked: stacked labels muted (same tone as T10), param group frameless (same as T10),
  dialog geometry and Cancel/Save placement unchanged at 1024 and 1180, error text placed as before.
  One visible difference to judge: the busy Save (saving-1180) is no longer dimmed. T10 used native `disabled`
  (dimmed); T11 uses `busy` (aria-disabled, focus kept, DESIGN 9.10), so the spinner replaces the label at full
  strength. Intended by A1, but it is your call whether it reads as busy enough.
  Not like-for-like: long-name shot (different text than T10), ok-1024 not shot.
