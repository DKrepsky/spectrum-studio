---
name: webkit-probe-recipes
description: Temporary WebDriver probe recipes that worked in round 2 (seed per spec basename, computed-style colour checks, badge-column measurement, IPC spy limits)
metadata:
  type: reference
---

- A temporary probe spec needs its own seed folder: `seedConfig` in `e2e/wdio.conf.ts` copies `e2e/fixtures/seed/<spec basename>/` (basename without `.e2e.ts`). Copy `seed/visual/sources.json` to `seed/<probe>/` for the seeded source rows, and delete both afterwards.
- Run one probe: `PATH=/tmp/claude-1000/wkd/x/usr/bin:$HOME/.cargo/bin:$PATH SPECTRUM_E2E_SHOTS=<dir> npx wdio run e2e/wdio.conf.ts --spec e2e/specs/<probe>.e2e.ts` (about 20 s).
- Colours: read `getComputedStyle(el).backgroundColor` after `moveTo()` plus a 400 ms pause. Compare with the idle value. Disabled buttons still match `:hover` in CSS, so check the disabled state separately.
- Focus after `Tab` from a JS-focused source button reads `:focus-visible` true and gives a 2px solid ring. A WebDriver `click` leaves no ring, which is correct.
- Badge column check: measure `.src-badge` and `.source-actions` inside `.source-row` after the hover settles. Equal left and right means the actions sit in the column.
- `window.__TAURI_INTERNALS__.invoke` monkey-patching did NOT record `start_acquisition` calls in this build (the counter stayed empty). Do not rely on it for IPC counts. Use state sequences or unit tests instead.
- Do not send extra Space presses in a probe without tracking the state. A stray press left the session Acquiring and failed the next `waitForState('Connected')`.
