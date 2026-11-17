# developer memory index

<!-- One line per memory: - [Title](file.md) — hook. Memory files live beside this index. -->
- [E2E quirks](e2e-quirks.md) — WebKitWebDriver PATH, seeds, 1024 window clamp, hardware snapping, revert-proof recipe, wdio 10 in-page async, getText on hidden text, waitForGone, window focus, HEAD worktree before-shots
- [SA430 reconnect on hardware](sa430-reconnect-hardware.md) — reboot/plug-in timings, udev PermissionDenied race, retry ladder outcomes
- [App exit check](app-exit-check.md) — launch isolated debug app, wmctrl close, timing the exit and watcher stop
- [src/ui CSS token contract](ui-css-token-contract.md) — box-shadow literals fail the token test (use outline); format only your own folders
- [Frequency Escape stale draft](frequency-escape-stale-draft.md) — old FrequencyInput commits on Escape; new fields use a draft ref
- [CSS not imported is silent](css-import-silent.md) — a ui .css that its .tsx never imports ships with no styles; contract tests reading the file still pass
- [Dialog busy/error probes](dialog-busy-error-probes.md) — invoke is not patchable; FIFO at sources.json.tmp holds a save busy, a directory there gives a save error
- [CSS geometry probes](css-geometry-probes.md) — pixel-literal guard, computed-style dump before/after, why an outside focus ring looked inside
- [Storybook a11y checks](storybook-a11y-checks.md) — jsdom axe vs real-Chrome run recipe, button/form/row-name gotchas from 010 rework 2
