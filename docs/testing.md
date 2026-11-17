# Testing

## Strategy

| Level | Where | Tools | Covers |
| --- | --- | --- | --- |
| Unit (Rust) | next to the code in `crates/spectrum-core/src` | `cargo test` | DSP numerics (normalisation, ENBW, scalloping, noise level, peak accuracy), parameter validation, simulator determinism and faults, persistence |
| Integration (Rust) | `crates/spectrum-core/tests/` | `cargo test` | Full sessions: lifecycle, switching, settings validation, device loss and reconnect, read errors |
| Contract | `frame.rs` ↔ `src/ipc/frame.test.ts` | both | Binary frame encoding/decoding with a shared fixture; generated TS types keep IPC shapes in sync |
| Unit/component (UI) | `src/**/*.test.ts(x)` | Vitest, Testing Library, jsdom | Formatting/parsing, scales, envelopes, colour maps, markers, liveness, stores, toolbar, notices, forms, source button/menu (IPC mocked) |
| Stories (UI) | `src/ui/stories.test.tsx` | Vitest, Storybook portable stories, axe-core (jsdom) | Every `src/ui` component folder has a stories file; every story renders, runs its play function without a thrown error or a `console.error`, and has no axe violation (`region` off, as in the addon; a story narrows rules with `parameters.a11y.config`); no app file imports Storybook or a stories module (ADR 0016) |
| Guards (UI) | `src/styles/tokens.test.ts`, `src/ui/boundary.test.ts`, `src/ui/cssImport.test.ts` | Vitest (reads the source files) | Every token used is defined; no colour, radius, shadow or z-index literal outside the token file; no pixel size or spacing literal (padding, margin, gap, inset, width, height, min and max, font size, outline and border width) outside the hairlines `0`, `1px`, `-1px`; the contrast pairs of DESIGN.md 9.3 and 9.4; the token file equals DESIGN.md Appendix A; `src/ui/` imports no IPC, state, bindings, plot, feature, Tauri or zustand module and no `toFixed` or `toLocaleString`; every `src/ui/` stylesheet is imported by its component |
| End-to-end | `e2e/specs/` | WebdriverIO + tauri-driver + WebKitWebDriver | The real binary: simulator workflow, continuous and single capture (mode menu, one sweep then stop), settings, markers, failures and recovery, planned drivers hidden, removed drivers' entries hidden, remembered sources, Add/Edit source dialog, persistence across restart (including the capture mode), `sources.json` migration (v1 and the duplicated-SA430 store), real-pixel layout guard |

Rules: every bug fix gets a regression test; tests assert user-visible outcomes and numeric
tolerances, not implementation details; tests never touch the user's real configuration.

## Running

```sh
npm run check          # everything except E2E
cargo test --workspace # Rust only
npm test               # UI only
```

### End-to-end tests

Prerequisites (once):

```sh
sudo apt install webkit2gtk-driver wmctrl   # WebKitWebDriver; wmctrl for the focus checks
cargo install tauri-driver --locked
```

Without root, extract the Ubuntu package into a scratch directory and put its binary on `PATH`:

```sh
mkdir -p "$DIR/deb" "$DIR/root" && cd "$DIR/deb"
apt-get download webkit2gtk-driver && dpkg-deb -x webkit2gtk-driver_*.deb "$DIR/root"
PATH="$DIR/root/usr/bin:$PATH" npm run e2e
```

Then, in an X11 or Wayland desktop session:

```sh
npm run e2e        # builds target/debug/spectrum-studio (no bundle) and runs all specs
npm run e2e:run    # reuse the existing debug binary
SPECTRUM_E2E_SA430=1 npm run e2e:run -- --spec e2e/specs/sa430.e2e.ts   # real TI SA430 on USB (skipped by default)
```

The focus checks (`:focus-within` of a row's actions) need the app window to have OS focus.
`ensureWindowFocus` (`e2e/specs/helpers.ts`) raises it with `wmctrl -a "Spectrum Studio"`. `wmctrl`
is required on an X11 desktop (`sudo apt install wmctrl`): without it on `PATH` the focus tests fail
with a message that names it, and they never skip silently. Dialogs and menus are awaited with
`waitForGone(testId)` (the same helper file), not with fixed sleeps.

Each spec file starts the app through `tauri-driver` with `XDG_CONFIG_HOME` pointing to a fresh
temporary directory, so preferences are isolated; the persistence spec restarts the app within the
same directory to verify that settings survive. Override the binary with
`SPECTRUM_STUDIO_BINARY=/path/to/binary` and the driver with `TAURI_DRIVER=...`.

Seeding: a spec can start with a prepared configuration directory. Files in
`e2e/fixtures/seed/<spec name>/` (for example `failures/sources.json`) are copied into the isolated
`io.github.spectrumstudio` config directory before the first launch of that spec; `{{REPO}}` in them
is replaced with the repository root. This is how E2E reaches states the UI cannot create (a
simulator that fails to connect, a remembered entry of a removed driver) and how
`migration.e2e.ts` starts from a version 1
`sources.json`. Seeds must match the current `sources.json` schema (`store.rs`). Specs that need
to inspect files the app wrote read `SPECTRUM_E2E_APP_CONFIG`. Note that WebKitWebDriver's
`getText` returns nothing for the ellipsised source names, so specs read them with
`textOf()` (textContent) or the button's `aria-label`.

Failed E2E tests save a screenshot to `e2e/logs/` (git-ignored).

### Accessibility of the stories

`npm test` runs axe-core (the engine of `@storybook/addon-a11y`) on every story after it renders,
so `npm run check` fails on a new violation. jsdom does not lay out, so `color-contrast` is not
judged there (it reports "incomplete"); the contrast pairs are guarded by the token tests (DESIGN.md
9.3, 9.4). For the rest, run the real browser:

```sh
npm run storybook            # then open the Accessibility panel of each story (addon-a11y)
npm run build-storybook      # static copy in storybook-static/, for a browser run with axe
```

The panel runs axe in the browser with the same rules. A story that needs an exception sets it on
the story (`parameters.a11y.config.rules`), not globally, and says why in a comment there.

Hardware specs: with a TI SA430 on `/dev/ttyACM0` and `SPECTRUM_E2E_SA430=1`, `sa430.e2e.ts`
(the launch auto-connect connects it paused and remembers one row, Add source… with the real port
and *Test connection* with the second row refused, rename through Edit leaves one row also after a
restart, live dBm sweeps, centre restore, no auto-reconnect after a manual disconnect, one Single
capture, five immediate Cancel presses with no frame shown), the hardware cases of
`add-source.e2e.ts` and the *Add dialog OK* screenshot of `visual.e2e.ts` run; without the
variable they are skipped. The *different device on this port* state needs a second analyzer and
is reported as skipped, never mocked.

### Visual guard

jsdom cannot lay anything out, so `e2e/specs/visual.e2e.ts` measures real pixels (WebKitGTK,
`getBoundingClientRect`) in the built app, seeded from `e2e/fixtures/seed/visual/` with the real
name `SA430 08FF41E50F8B3A34`, a 22- and a 60-character name, a failing simulator and an SA430 with
a long serial-port path. At 1180 and 1024 px (the window cannot go below 1024, so a 520 request is
clamped and logged) it asserts:

- the source button is 150 to 280 px wide, shows the 22-character name untruncated and ellipsises
  the 60-character one only while its `aria-label` carries the full name; the page and toolbar do
  not scroll sideways;
- every menu row has one name column (identical left and right edge for USB and Built-in
  rows), a badge column of exactly 64 px at the same left edge, a line 2, equal row heights, and a
  `title` whenever a name is cut;
- hovering or focusing a row moves nothing and the hover actions stay inside the badge column and
  clear of line 2;
- the popover and the Add/Edit dialog lie inside the window and nothing inside them overflows
  (`assertNoOverflow` in `helpers.ts`);
- the status circles differ in computed fill, border and shape (connected, idle, absent, failed).

It fails if the 64 px column or the button's 280 px maximum is reverted (checked by hand when the
guard was written). Screenshots of the key states are written to `e2e/logs/visual/<state>-<width>-<data>.png`
(or the directory in `SPECTRUM_E2E_SHOTS`). The guard supplements looking at them; open the images
when the UI changes. The hardware-only cases are skipped unless `SPECTRUM_E2E_SA430=1` is set.

### Visual before and after (UI changes)

A change that touches a screen is checked against the base revision (DESIGN.md 10.4):

1. Check out the base revision in a git worktree and build it there (`npm run e2e` builds the debug
   binary). Run `SPECTRUM_E2E_SHOTS=<dir>/before npm run e2e:run -- --spec e2e/specs/visual.e2e.ts`
   from that worktree.
2. On the change, run the same command with `SPECTRUM_E2E_SHOTS=<dir>/after`.
3. Open the pairs with the Read tool, one state at a time (the popover, the mode menu, the Add/Edit
   dialog in its states, the capture control, the banners, the status bar, the side panel, 1440 and
   1024 px and a narrow window). List each difference and tie it to the item that asked for it. Any
   other difference is a regression.

Passing assertions do not replace this look.

### Auto-connect on real hardware (manual QA)

Auto-connect (ADR 0014) is covered in Rust by the core and driver tests with fake drivers and a
scripted SA430 link. The steps below need a real TI SA430 and cannot run in CI. Run them in an
isolated configuration so the user's `sources.json` is not changed:

```sh
mkdir -p "$DIR/cfg" && XDG_CONFIG_HOME="$DIR/cfg" RUST_LOG=spectrum_core=debug,spectrum_driver_sa430=debug,info npm run tauri dev
```

Log lines to look for (stderr): `auto-connected`, `source connected`, `source disconnected`,
`auto-connect failed`, `device watching is unavailable`. Record each result with the time and the
log excerpt in the work item's `dev-T3.md` (or the QA report).

1. **Launch with the device attached**, nothing selected: the source button shows the SA430 serial,
   the status is Stopped (paused), and the capture button is not pressed. No notice.
2. **Unplug while paused**: a `DeviceLost` notice "SA430 … was unplugged." appears and the source
   button shows no connection promptly (within a few seconds). No crash, no hang.
3. **Plug back in while nothing is connected**: the device connects by itself, paused, within a few
   seconds. The notice stays until dismissed or the next status change, as for any notice.
4. **Unplug while acquiring** (capture pressed in Continuous): the trace stops with the same notice; replug connects
   paused (acquisition is not restarted).
5. **Re-enumeration**: `Sa430::reboot()` (the `reboot_then_connect_*` tests in
   `crates/spectrum-driver-sa430/tests/hardware.rs`, run while the app is closed because the app holds
   the port exclusively) three times; after each, the app launched again connects by itself.
6. **Simulator connected, then plug-in**: select the simulator, then plug the SA430 in. The
   simulator stays connected; nothing changes.
7. **Manual disconnect**: disconnect from the source menu with the device attached. It stays
   disconnected (no reconnect on its own) until the device is plugged in again or the app restarts.
8. **Failed attempt** (optional): with the port held by another program, plug in. One
   `ConnectFailed` notice, no repeated attempts; the next plug-in tries again.

Quit with the window close button: the log must show `source disconnected` and no device error.
