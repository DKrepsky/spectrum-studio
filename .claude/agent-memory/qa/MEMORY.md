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
