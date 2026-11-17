# 010 Storybook

Story: https://github.com/DKrepsky/spectrum-studio/issues/36

Status: accepted

Decisions:
- Tool: Storybook (human, 2026-11-17), dev-only, ADR required.
- PM 2026-11-17: no Storybook addons; DESIGN.md 10.2/10.3 gets the "ships with stories" rule; add `npm run storybook` row to CLAUDE.md commands table; a11y addon → follow-up issue at outcome.
- PM 2026-11-17 (QA D4): busy Button keeps shipped behaviour (spinner, label transparent but kept as accessible name and width, DESIGN.md 4.1). Fix DESIGN.md 4.12 wording to match; no visual change.
- Human 2026-11-17: accepted, but fix the three follow-ups BEFORE commit (not as issues):
  1. Badge long text: single line, ellipsis, full text in native `title` (DESIGN.md 5.9 rule 2); add rule to DESIGN.md 4.7.
  2. Menu item without icon: the 18px icon column stays reserved (empty) so name/description/check stay aligned (DESIGN.md 4.11).
  3. Add @storybook/addon-a11y; every story is clean or each violation is fixed/justified; ADR 0016 updated for the new dependency.
- PM 2026-11-17: Popover row accessible name stays name + status (DESIGN 9.12); badge/port outside it; per-story label-content-name-mismatch exemption accepted. Dev-only npm audit moderates accepted (fix = Storybook downgrade). Intermittent e2e "Forget not interactable" = existing #24.
