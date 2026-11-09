# Testing

## Strategy

| Level | Where | Tools | Covers |
| --- | --- | --- | --- |
| Unit (Rust) | next to the code in `crates/spectrum-core/src` | `cargo test` | DSP numerics (normalisation, ENBW, scalloping, noise level, peak accuracy), parameter validation, simulator determinism and faults, persistence |
| Integration (Rust) | `crates/spectrum-core/tests/` | `cargo test` | Full sessions: lifecycle, switching, settings validation, device loss and reconnect, read errors |
| Contract | `frame.rs` ↔ `src/ipc/frame.test.ts` | both | Binary frame encoding/decoding with a shared fixture; generated TS types keep IPC shapes in sync |
| Unit/component (UI) | `src/**/*.test.ts(x)` | Vitest, Testing Library, jsdom | Formatting/parsing, scales, envelopes, colour maps, markers, liveness, stores, toolbar, notices, forms, source button/menu (IPC mocked) |
| End-to-end | `e2e/specs/` | WebdriverIO + tauri-driver + WebKitWebDriver | The real binary: simulator workflow, settings, markers, failures and recovery, planned drivers hidden, removed drivers' entries hidden, remembered sources, Add/Edit source dialog, persistence across restart, `sources.json` migration (v1 and the duplicated-SA430 store), real-pixel layout guard |

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
sudo apt install webkit2gtk-driver   # provides WebKitWebDriver
cargo install tauri-driver --locked
```

Then, in an X11 or Wayland desktop session:

```sh
npm run e2e        # builds target/debug/spectrum-studio (no bundle) and runs all specs
npm run e2e:run    # reuse the existing debug binary
SPECTRUM_E2E_SA430=1 npm run e2e:run -- --spec e2e/specs/sa430.e2e.ts   # real TI SA430 on USB (skipped by default)
```

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

Hardware specs: with a TI SA430 on `/dev/ttyACM0` and `SPECTRUM_E2E_SA430=1`, `sa430.e2e.ts`
(detected without a scan, Add source… with the real port and *Test connection*, rename through
Edit leaves one row also after a restart, live dBm sweeps, centre restore), the hardware cases of
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
when the UI changes. One known defect is recorded as a skipped test in that file.
