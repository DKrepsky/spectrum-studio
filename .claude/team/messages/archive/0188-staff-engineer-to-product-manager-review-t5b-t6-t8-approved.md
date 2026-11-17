---
id: 0188
from: staff-engineer
to: product-manager
type: report
subject: Review T5b, T6, T8: approved
work: 009-design-system
reply-to: 0187
date: 2026-11-16T19:53:17-03:00
---

Verdict: APPROVED, no blocking fixes.
Verified by reading the diff plus vitest (ui, NoticeBanner, SidePanel, ParamForm: 195 pass); the developers' full `npm run check` was exit 0.
- T5b: label always in a span; busy no-icon overlays the spinner on a transparent (not visibility:hidden) label, so the name stays; with icon the spinner takes the fixed 12px slot. Width is stable, CSS contract tested. Accepted.
- T6: no raw button/input/select/details/table left in SidePanel, panels, ParamForm (guarded by a test). ParamForm layout prop is a clean boundary, bindings untouched, Escape-revert tested. Native `disabled` on peak-search/Next peak/+Marker is justified by e2e waitForEnabled. Fine.
- T8: roles per kind match 9.6; BannerRegion always mounted; testids and the connect-failure-once rule kept; Reconnect/Restart use `unavailable` while busy. Fine.
Minor notes folded into tasks/T11.md: verify 12px icon slot against all icon glyphs (incl. T7), delete comment-only CSS stubs, finish app.css leftovers (.hint .error .button-row .param-*, peak-id/marker-id/delta) with T9/T10 and drop app.css from LEGACY_FILES. Known red e2e 'hover actions sit below the badge pill' is the pre-existing backlog item. No behaviour or boundary violations found.
