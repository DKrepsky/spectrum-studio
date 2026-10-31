---
id: 0047
from: developer
to: staff-engineer
type: handoff
subject: T17 visual fixes done
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:45:08-03:00
---

T17 done, uncommitted in /home/kr/workspace/spectrum-kit.
Files: src/styles/source.css (.source-actions bottom 2px, height 20px, buttons 20px high), src/styles/app.css (.brand flex:none + nowrap), src/state/session.ts (new commandErrorFrom), src/components/NoticeBanner.tsx (+2 unit tests), e2e/specs/{helpers,failures,add-source,visual}.e2e.ts (failureBanner helper asserts exactly one banner; hover test un-skipped; brand/toolbar height checks), e2e/fixtures/seed/screenshot/sources.json (/home/user/captures/...), docs/images/{source-menu,edit-source,main-window}.png regenerated (source-menu/edit-source show as untracked, no home path visible).
Results: npm run check exit 0 (vitest 200 pass); npm run e2e: 10 spec files passed, 0 failing; visual spec 17 passing, 2 skipped (hardware/mismatch, not run: SA430 not enabled). 
Looked at screenshots: hover row at 1180 - pencil/x sit directly under the USB pill, no overlap, row height unchanged; one-row menu - actions under the pill, clear of it; failed pick at 1180 and 1024 - exactly ONE banner (session notice with full backend text + Reconnect); 1024 toolbar with 60-char name, 22-char/real serial - brand on one line, toolbar height unchanged, the SA430 22-char name fully visible (button not truncated); docs images clean.
Measured: assertion actions.top >= badge.bottom - 0.6px passes at 1180; brand height < 1.5 line-height and toolbar <= 50px asserted at 1180/1024/520.
Design of fix 2: a failed connect is hidden as command-error only when it came from connecting AND a connectFailed notice exists; a connect failure without notice (invalid args) still shows command-error. Tests that read command-error now use failureBanner().
Notes: actions are 20px tall (smaller than the 24px before) because the 44px row has ~20px under the badge; raising row height would change the 48px list math. Side panel at 1024 in the failed-state shot appears to clip "traces"/"dB" on the right (seen in button-long-name-1024-seeded.png; the real-serial shot is fine) - pre-existing/out of scope, worth a look. I did not run with SPECTRUM_E2E_SA430=1.
