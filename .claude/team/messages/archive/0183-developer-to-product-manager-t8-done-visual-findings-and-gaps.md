---
id: 0183
from: developer
to: product-manager
type: handoff
subject: T8 done: visual findings and gaps
work: 009-design-system
reply-to: 
date: 2026-11-16T19:50:43-03:00
---

T8 visual check (banners), shots in .claude/team/work/009-design-system/evidence/after-T8/ compared with before/ and after-T1/.

Intended changes, confirmed
- Warning (acquisitionFailed) tint: background pixel (35,32,28) before and after-T1 becomes (40,36,30) after-T8, i.e. amber 10% to 12% (F10). Visible in banner-warning-1024 and -1440.
- Error tint (deviceLost, connectFailed): pixel-identical before and after (40,27,34).
- Dismiss "x": now the 24px IconButton (ghost, secondary text colour), last in the banner. The glyph looks dimmer and sits about 1px differently.
- Reconnect/Restart: now `Button`. The label box and edges move by about 1 to 2px; otherwise the same look.
- Pixel diff of the banner strip (y 40-100): only the Reconnect/Restart and dismiss area differs for connect-failed and device-lost, at both widths. The 1440 toolbar is identical.

Not from T8, for your awareness
- banner-warning-1024: the toolbar "Continuous" fill is (62,224,181) after-T8 but (43,199,158) before and after-T1. T8 does not touch the toolbar, and the 1440 toolbar is identical. Probably pointer hover where the shot was taken. Not reproduced; QA could check.
- The side panel differs in the after-T8 shots (T6 in progress). Out of scope.

Gap
- No command-banner shot (the visual spec cannot produce a command error). Command banners use the same Banner, tone error, so they match the connect-failed error banner. Flag if you want a dedicated shot.

Open for staff (not my files)
- src/ui/Banner/Banner.css header says `.notice` in app.css "stays until T10". It is removed now.
- src/components/capture/CaptureControl.tsx (~line 117) says the "role=alert notice" already announces a failure. connectFailed is now role=status (9.6), so the comment is stale.
