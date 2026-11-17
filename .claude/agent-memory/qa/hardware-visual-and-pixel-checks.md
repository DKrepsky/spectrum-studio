---
name: hardware-visual-and-pixel-checks
description: How QA ran the real-SA430 visual and SA430 specs, and the PIL/PNG checks used to compare before and after shots (toolbar border rows, name vs width, tag crops)
metadata:
  type: reference
---

- Real hardware run: `SPECTRUM_E2E_SA430=1 npm run e2e:run -- --spec e2e/specs/visual.e2e.ts` (and `sa430.e2e.ts`). The device must be on `/dev/ttyACM0`. Visual with the device: 49 passing, 1 skipped (two-analyzer state). Shots go to `SPECTRUM_E2E_SHOTS` and carry real names such as `toolbar-acquiring-real-1024-sa430.png`.
- WebKitWebDriver without root: `apt-get download webkit2gtk-driver` in a new empty dir, then `dpkg-deb -x` into it; put `<dir>/usr/bin` on PATH. Use the session scratchpad, not a fixed `/tmp/claude-1000/wkd` path (it may be gone).
- Name-vs-width check: read bytes 16-19 of each PNG (IHDR width, big-endian) and compare with the `-<width>-` in the file name. The fixed visual spec gives 0 mismatches; the older one gave 12 to 51.
- Pixel positions: PIL column scan for the toolbar's bottom border (sum of RGB differences > 25 between neighbouring rows). Measured 48 before, 44 after at 1440 (a 4px toolbar change under F1).
- Before/after crops: a small PIL script that stacks crops with a magenta separator and scales them 2x with NEAREST, saved under the work folder's `screenshots/`.
- Computed-geometry JSON diff (`css-*.json` from the developer's probe): compare `rect` and `vals` per element key. Side-panel diffs come from the live peak count, so compare idle, narrow and zoom states for pure CSS changes.
- The SA430 row-action flake (`clickRowAction` in `e2e/specs/helpers.ts`) seen once in 2 runs; an isolated re-run passed. See [[e2e-baseline-and-timing]] for the hover transition trap.
