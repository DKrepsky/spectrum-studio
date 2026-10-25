# Development

## Toolchain

| Tool | Version used | Notes |
| --- | --- | --- |
| Rust | 1.94 (MSRV in `Cargo.toml`) | install with rustup |
| Node.js | 24 (≥ 22 required) | npm 11 |
| Tauri | 2.12 (crate and `@tauri-apps/*` packages must share major.minor) | |
| TypeScript | 6.0 (pinned: typescript-eslint supports < 6.1) | |
| System | Linux Mint 22 / Ubuntu 24.04, WebKitGTK 4.1 | see below |

```sh
sudo apt install build-essential curl wget file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev
npm install
```

## Project layout

```
Cargo.toml                 Rust workspace (crates/spectrum-core, src-tauri)
crates/spectrum-core/      domain library: model, dsp, sources, session, formats, store
  tests/                   cross-module integration tests (session, files)
src-tauri/                 Tauri shell: commands.rs, sink.rs, capabilities/, tauri.conf.json, icons/
src/                       React UI
  bindings/                generated TypeScript types (ts-rs) — do not edit
  ipc/                     typed command wrappers, binary frame decoder
  state/                   zustand stores, frame store/pump, liveness, helpers
  plot/                    canvas renderers, scales, colour maps, marker maths
  components/              React components (panels/, sources/)
e2e/                       WebdriverIO end-to-end tests and screenshot tool
docs/                      documentation and ADRs
.claude/                   agent settings and skills
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run tauri dev` | Run the app with hot reload (Vite on :1420 + cargo run) |
| `npm run check` | Full gate: rustfmt, clippy `-D warnings`, cargo tests, Prettier, ESLint, tsc, Vitest |
| `npm run check:rust` / `npm run check:web` | Halves of the above |
| `cargo test --workspace` | Rust tests (also regenerates `src/bindings` and the frame fixture) |
| `npm test` | Frontend unit/component tests |
| `npm run bindings` | Regenerate TypeScript bindings only |
| `npm run e2e` | Build a debug binary and run the end-to-end suite (see testing.md) |
| `npm run docs:screenshot` | Regenerate `docs/images/main-window.png` via WebDriver |
| `npm run tauri build` | Release build and bundles |

### TypeScript bindings

Rust types with `#[derive(TS)] #[ts(export)]` are written to `src/bindings/` by `cargo test`
(`TS_RS_EXPORT_DIR` is set in `.cargo/config.toml`). Commit the generated files together with the
Rust change. The frontend never declares backend types by hand.

### Binary frame fixture

`model::frame::tests::write_frontend_fixture` writes `src/ipc/__fixtures__/frame-v1.bin`, which
`src/ipc/frame.test.ts` decodes — a contract test between the Rust encoder and the TS decoder.

## Packaging

```sh
npm run tauri build
```

Produces in `target/release/bundle/`:

- `deb/Spectrum Studio_<version>_amd64.deb` — `sudo apt install ./Spectrum*.deb`; depends on the
  system WebKitGTK.
- `appimage/Spectrum Studio_<version>_amd64.AppImage` — `chmod +x` and run; bundles its libraries.
  Building it downloads `linuxdeploy` on first use (network required once).

Bundle settings live in `src-tauri/tauri.conf.json` (`bundle`). Icons are generated from
`src-tauri/app-icon.svg` with `npx tauri icon src-tauri/app-icon.svg -o src-tauri/icons` (then
delete the non-Linux variants).

## Debugging tips

- Run `npm run tauri dev` and open the webview inspector with right-click → Inspect.
- Backend messages go to the terminal that started the app.
- The app's config directory can be redirected with `XDG_CONFIG_HOME=/tmp/x` for a clean state.
