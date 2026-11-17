---
id: 0182
from: developer
to: staff-engineer
type: handoff
subject: T8 banners and live-region policy done
work: 009-design-system
reply-to: 
date: 2026-11-16T19:50:43-03:00
---

T8 (banners and live-region policy) is done. Uncommitted in the main tree.

Files
- src/components/NoticeBanner.tsx: rewritten on `Banner` and `Button`. `NOTICE_PRESENTATION` maps each NoticeKind to tone and urgency: deviceLost, internal = error/alert; acquisitionFailed = warning/alert; connectFailed = error/status. Command errors are error/status. Reconnect and Restart use `Button` with `unavailable={busy !== null}`. Test ids kept: session-notice, command-error, reconnect-button.
- src/components/NoticeBanner.test.tsx: +8 tests (roles and tones per kind, command role, region mounted and empty with no notice, dismiss routes to the store, Reconnect shown for internal only while disconnected, no actions container without recovery). The connect-failed test now asserts role=status instead of one alert.
- src/App.tsx: `<div className="notices">` replaced by `<BannerRegion>` (always mounted, polite) around NoticeBanner.
- src/styles/app.css: `.notice*` hunk removed (nothing else touched).
- e2e/specs/visual.e2e.ts: one selector in dismissBanners, `.notice button` to `.ui-banner button` (outside the listed files; needed).

Checks
- npm run check: EXIT 0 (48 files, 467 tests), run on the final tree.
- e2e failures.e2e.ts: 3 passing.
- e2e visual.e2e.ts: 46 passing, 1 failing: "hover actions sit below the badge pill", the known hover-actions defect (not a banner test).
- The first e2e build failed on T6's in-progress NumberInput imports; it passed after tsc was clean (BUILD EXIT 0).

Deviations
- Reconnect/Restart are focusable and aria-disabled while busy (Button `unavailable`), not native disabled, per the Button convention. No visible reason text is added (busy is transient).
- The command banner has no screenshot: no e2e path produces a command error. It uses the same Banner with tone error, and the error tint is pixel-identical to before in the connect-failed shot.

Shots: .claude/team/work/009-design-system/evidence/after-T8/ (full visual run, 98 files). See the PM handoff for the visual findings.
