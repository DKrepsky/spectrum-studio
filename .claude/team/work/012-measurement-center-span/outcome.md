# 012 Outcome — accepted 2026-11-18
Issue: #38

| Criterion | Result | Evidence |
| --- | --- | --- |
| Toolbar = brand + source group only | Pass | qa.md AC1; r2-visual-toolbar-*.png, toolbar-60-idle-1024/1440.png |
| Center then Span first in Measurement, inline, aligned | Pass | r2-visual-panel-measurement-1440/1024-sim.png; all rows 140x28 |
| Commit Center / pick Span applies; plot + status strip update | Pass | sim + SA430 (qa.md AC3); r2-sa430-center-span-10M-1440-real.png |
| Disabled states and reasons unchanged | Pass | no source in app (r3-nosource-1440.png, shows "—"); untunable/fixed-span/applying by unit tests (no such source in build) |
| Keyboard + labels; DESIGN, unit, e2e updated | Pass | Tab order and focus ring (qa.md AC5); screen reader not run |
| `npm run check` | Pass | PM re-ran: exit 0 |
| e2e | Pass | acquisition 18, failures 3, add-source 6, edit-source 4, visual 47 (QA round 3) |

Fixed in this change (human: "fix both, then commit"): BUG-012-QA-1 (Center clipped ≥ 1 GHz → panel inline
width 140px), Enter/pick no longer drops focus (Center, Span, Source settings params are read-only while applying
instead of disabled; BUG-012-QA-2), no-source Center shows "—", GHz visual guard, DESIGN.md 3.2/3.9/9.9/Q-5
re-measured. Raw e2e visual shots in evidence/ (gitignored).

Not changed: Escape still blurs a frequency field; SA430 status strip shows device-quantised values (433.919 MHz).
