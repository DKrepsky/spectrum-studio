# Testing

## Strategy

| Level | Where | Tools | Covers |
| --- | --- | --- | --- |
| Unit (Rust) | next to the code in `crates/spectrum-core/src` | `cargo test` | DSP numerics (normalisation, ENBW, scalloping, noise level, peak accuracy), parameter validation, simulator determinism and faults, file parsers, CSV, persistence |
| Integration (Rust) | `crates/spectrum-core/tests/` | `cargo test` | Full sessions: lifecycle, switching, settings validation, device loss and reconnect, end of stream, SigMF playback, CSV export → import round trip |
| Contract | `frame.rs` ↔ `src/ipc/frame.test.ts` | both | Binary frame encoding/decoding with a shared fixture; generated TS types keep IPC shapes in sync |
| Unit/component (UI) | `src/**/*.test.ts(x)` | Vitest, Testing Library, jsdom | Formatting/parsing, scales, envelopes, colour maps, markers, liveness, stores, toolbar, notices, forms, source manager (IPC mocked) |
| End-to-end | `e2e/specs/` | WebdriverIO + tauri-driver + WebKitWebDriver | The real binary: simulator workflow, settings, markers, failures and recovery, planned drivers, recordings, persistence across restart |

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

Failed E2E tests save a screenshot to `e2e/logs/` (git-ignored).

Not automated: the native save dialog of *Export CSV* cannot be driven through WebDriver. The CSV
writer and the export → import path are covered by Rust tests; the dialog itself was verified
manually.
