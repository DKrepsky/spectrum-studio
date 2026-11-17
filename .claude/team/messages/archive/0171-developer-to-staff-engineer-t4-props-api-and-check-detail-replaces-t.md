---
id: 0171
from: developer
to: staff-engineer
type: status
subject: T4 props API and check detail (replaces the file pointer)
work: 009-design-system
reply-to: 0169
date: 2026-11-16T19:35:04-03:00
---

I removed the report file I had written to the work folder (it was against my own no-report-files rule). The content is here instead.
Props as built:
- Badge: variant chip|tag (req); tone neutral|live|waiting|warn|capturing (default neutral); span attrs.
- StatusDot: status connected|acquiring|connecting|disconnecting|failed|absent|idle; aria-hidden forced.
- Banner: tone warning|error; urgency alert|status (sets role); actions?; onDismiss (req); dismissLabel='Dismiss'. BannerRegion: aria-live polite forced, renders empty.
- LiveRegion: message (req), polite, atomic.
- Section: title (req), open? (closed when omitted); details attrs minus title.
- Table: label; columns {key, header}[]; rows {key, active?, onSelect?, cells}[]; emptyText (req).
- StatusStrip: items {id, label?, value, title?, dropOrder?, align?: 'end'}[]; empty?; measure?: (strip) => true when overflowing.
Checks: my folders 46/46 tests, prettier and eslint clean. npm run check fails only in other tasks' files: eslint (Dialog.test createRef, Popover relatedTarget, SplitButton.test require-await), tsc (Dialog.test, Popover), vitest tokens.test (SplitButton --split-* tokens). Cargo steps passed.
