---
name: no-device-run-recipes-015
description: How to run the no-device (SA430 unplugged) e2e and screenshot probes in this repo, what runSimulator really does, and the DOM-injection method for measuring SA430-only rows; work 014/015 QA
metadata:
  type: reference
---

- WebKitWebDriver without root: `apt-get download webkit2gtk-driver` in a scratch `deb/` dir, `dpkg-deb -x` into `root/`, then `PATH=<root>/usr/bin:$HOME/.cargo/bin:$PATH npm run e2e` (the e2e script builds the debug binary first; about 4 min). Full run about 6 min. Visual spec alone about 1.6 min.
- With no analyzer the launch-state tests run for real (not pending): `startup` and the first `acquisition` test. `persistence` runs its no-device branch.
- `runSimulator()` in `e2e/specs/helpers.ts` does not just connect: it picks the fixed row, then clicks the capture button, so the state is Acquiring. For a "connected, not acquiring" screenshot take it before calling runSimulator.
- Probe pattern: a temporary `e2e/specs/qa-<id>-probe.e2e.ts` run with `QA_OUT=<dir> npx wdio run e2e/wdio.conf.ts --spec ...`; write results to JSON with `fs` from the spec. Delete the probe from `e2e/specs/` afterwards (keep a copy in the gitignored evidence dir).
- Start-up "Loading…" check: install a MutationObserver on `document.documentElement` (attributes + childList + characterData) that records `[data-testid="source-button"]` aria-label, then `browser.reloadSession()`. The first recorded value is `Source: Loading…`.
- SA430-only rows without the device: clone an existing `.ui-field` in `.measurement-rows` (Averaging for NumberField, Span for Select), change label text, and insert. Measure `label.clientWidth` vs `scrollWidth`. Note the clone keeps the old unit text. This measures the real CSS; the values are fake.
- Measurement row order check: `.measurement-rows` children in DOM order; Tab from the source button and read `document.activeElement` to compare with the visual order.
- Work 015 (2026-11-19): the `migration-dup` failure was a stale count (launch fallback remembers an unnamed simulator record). Check `sources.json` in the spec's config dir before blaming the migration.

Related: [[webdriver-e2e-recipes]], [[webkit-e2e-recipes]], [[webview-zoom-simulation]], [[app-autoconnect-and-probe-setup]]
