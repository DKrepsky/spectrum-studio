---
name: prototype-method
description: How to build, screenshot and click-test a single-file HTML prototype on this machine (headless Chrome flags, hash scenario switches, jsdom flow tests, measuring toolbar overflow)
metadata:
  type: reference
---

Working recipe that was verified on this machine (Chrome 157 at /usr/bin/google-chrome, Firefox 159, jsdom in node_modules).

- Screenshot: `google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1440,760 --screenshot=<abs path>.png "file://<abs>/index.html#s=<scenario>&w=1440&still&bare"`. The `--no-sandbox` flag is needed. Ignore the dbus ERROR line; it is harmless.
- Hash flags used by 006's prototype: `s` (scenario), `w` (window width), `still` (no timers, so the screenshot is deterministic), `bare` (hide the chrome, app fills the window), `focus` (focus a `data-focus` element).
- Measurements: `--dump-dom` prints the DOM after scripts run. Writing measurements into an `<output>` element is a cheap way to check overflow and truncation without a layout test harness.
- Click tests: `require('/home/kr/workspace/spectrum-kit/node_modules/jsdom')` with `runScripts: 'dangerously'` runs the prototype's script and lets you click and dispatch KeyboardEvents. jsdom has no layout, so use it for flows only.
- Fonts: the app stack is Inter, Cantarell, Ubuntu, system-ui. On this machine Inter and Cantarell are missing and Ubuntu is installed, so headless screenshots use Ubuntu. Real WebKitGTK widths can differ, so QA must re-measure.
- Look at each PNG with the Read tool and crop toolbar strips with PIL (available) for close review.
- Shell: `rm -f "$VAR/*.png"` is blocked by the safety check when the variable could be empty. Use literal absolute paths. Scratch files go in the session scratchpad, not /tmp.

Related: [[design-conventions]]
