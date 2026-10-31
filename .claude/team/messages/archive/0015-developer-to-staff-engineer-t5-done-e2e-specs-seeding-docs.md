---
id: 0015
from: developer
to: staff-engineer
type: handoff
subject: T5 done: e2e specs, seeding, docs
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:43:53-03:00
---

T5 complete, nothing committed. `npm run check` exit 0 (128 Vitest, Rust, lint, both tsc). `npm run e2e`: 5 spec files, 23 tests, all passing (acquisition 8, failures 5, files 2, migration 3, persistence 5) plus sa430 skipped by default; with SPECTRUM_E2E_SA430=1 and the SA430 that is plugged in on this machine it passed (1 test). `npm run docs:screenshot` refreshed docs/images/main-window.png.
Tooling: WebKitWebDriver via apt-get download + dpkg-deb -x into scratchpad, put on PATH.

Harness: e2e/wdio.conf.ts seeds e2e/fixtures/seed/<spec>/* into $XDG_CONFIG_HOME/io.github.spectrumstudio on first creation ({{REPO}} replaced), exports SPECTRUM_E2E_APP_CONFIG. Seeds: failures (v2: plain sim, failConnect sim, uneven CSV, missing IQ), files (v2: IQ tone, CSV trace), migration (v1 incl. ghost + soapysdr). Small committed recordings in e2e/fixtures/recordings (tone is ci16, 100 kS/s, 120 KB). helpers.ts rewritten (selectSource, runSimulator, ensureDisconnected, openSourceMenu...).
Docs: user-guide (Choosing a source, first run, where stored), sources.md (enumerate-only discovery, remembered sources, planned hidden, SA430 replug), roadmap (new row, #8 note, SA430 stable-id follow-up, planned hidden but tracked), architecture, testing (seeding), README bullets.

Findings (UI, not fixed, src/ untouched):
1. After Forget then Undo, focus falls to body so Escape no longer closes the menu (Escape handler is inside the popover). Helper falls back to clicking the button. Minor a11y bug.
2. WebKitWebDriver getText returns "" for .src-name (overflow hidden ellipsis); screen readers should be fine, specs use textContent/aria-label.
3. Remembered simulator is labelled "Built-in simulator" while the fixed row says "Signal simulator" (label from device_label); naming mismatch in UI.
Deviations: failures seed includes an extra plain simulator because a remembered failing simulator hides the fixed Signal simulator row. Fault injection via failConnect is only reachable by seed (documented). grep for the old ids only matches reconnect-button and negative assertions.
