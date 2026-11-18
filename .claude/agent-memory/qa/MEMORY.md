# qa memory index

<!-- One line per memory: - [Title](file.md) — hook. Memory files live beside this index. -->
- [WebKitGTK e2e recipes](webkit-e2e-recipes.md) — run one spec, min window 1024, hover/focus and reduced-motion limits
- [Baseline comparison and transition timing](e2e-baseline-and-timing.md) — git archive HEAD build, WebKitWebDriver PATH, 150 ms hover-transition trap
- [WebDriver probe recipes](webkit-probe-recipes.md) — temp probe seeds per spec basename, computed-style colour checks, IPC spy does not work
- [WebDriver e2e recipes](webdriver-e2e-recipes.md) — running the real app under WebKitWebDriver; wdio/TS pitfalls seen in the 006 QA tour
- [Hardware replug recipes](hardware-replug-recipes.md) — non-root SA430 reboot via sa430 CLI, TIOCEXCL port holder, what needs root or a human
- [Hardware visual and pixel checks](hardware-visual-and-pixel-checks.md) — real SA430 visual run, PNG width vs name check, toolbar border scan, computed-geometry diffs
- [Reconnect-after-failure recipe](reconnect-failed-then-plugin-recipe.md) — TIOCEXCL holder then sa430 reboot to simulate fail-then-plug-in; HEAD baseline build steps
- [Known pre-existing e2e failures](qa-known-failures-011.md) — acquisition.e2e.ts 2 deterministic failures at HEAD (work 011)
- [WebDriver probe pitfalls (012)](webdriver-probe-pitfalls-012.md) — focus-visible needs OS focus (wmctrl), execute closures, status strip idle, SA430 range, GHz cropping check
- [Webview zoom simulation](webview-zoom-simulation.md) — Ctrl+= does nothing in this build; root CSS zoom as the stand-in and its limits
- [App autoconnect and probe setup](app-autoconnect-and-probe-setup.md) — SA430 auto-connects at launch; separate QA build dir; probe cascade trap (013)
