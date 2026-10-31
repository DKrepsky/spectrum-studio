---
id: 0056
from: developer
to: staff-engineer
type: handoff
subject: T19 done: source name no longer looks cropped at 1024
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T16:27:05-03:00
---

Changes
- src/styles/app.css: new `@media (max-width: 1180px)` block reclaiming toolbar space (toolbar gap 18->10 and side padding 12->8, group/field gaps 8/6->5, `.toolbar .freq-input` 150->128px, state-pill/badge padding smaller, Export CSV padding 12->10). No text/info removed; source.css untouched.
- e2e/specs/visual.e2e.ts: new `assertNameVisible` (name `.src-name` scrollWidth<=clientWidth for names <=22 chars; with SIMULATED badge needs >=18 visible chars; 60 chars must ellipsise with full name in title and aria-label; also asserts the Center input text is not clipped). Called for idle, connected and acquiring at 1180 and 1024. New hardware test (SPECTRUM_E2E_SA430) connects the seeded real-serial entry and checks connected + acquiring at 1180/1024.

Measurements (1024): SIMULATED + 22 chars "Simulated bench unit 2" is shown IN FULL (button ~200px), badge present, Export CSV right edge ~1016 of 1024. Real "SA430 08FF41E50F8B3A34" connected+acquiring on the real SA430: fully shown, no badge. 60-char names ellipsise ("Sim Very long source na...").
Guard proof: with the media query disabled the new visual spec fails: "connected at 1024: name cropped (83px of 134px, about 13/22 chars)". Note: my first attempt (freq-input 112px) clipped the Center text ("100.000000 MI"); caught by looking at the screenshot, fixed to 128px and added a Center-clipping assertion.

Results: npm run check exit 0; npm run e2e full: 10 spec files passed, 22 passing visual (one earlier run showed 1 failed spec file in the full run, not reproduced in 3 later full runs; looks flaky, not investigated); SPECTRUM_E2E_SA430=1 npm run e2e:run: 10 files passed, 24 passing visual, with real SA430 on /dev/ttyACM0.

Screenshots viewed (e2e/logs/visual/): toolbar-acquiring-22-1024-seeded, toolbar-acquiring-60-1024-seeded, toolbar-acquiring-real-1024-sa430 (real device, acquiring, full name, no clipping), connected-halo-menu-1180-sim (hover actions under badge, menu fine), typical-menu-1440-seeded (no regression). Did not view 1180 acquiring or the one-banner case separately; the existing guards for them passed.
Concerns: at 1024 the toolbar has only ~8px slack with the SIMULATED badge; any new toolbar control will need re-budgeting. Used the scratchpad WebKitWebDriver; nothing written to ~/.config. Nothing committed.
