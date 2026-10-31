---
name: verify
description: Run the full Spectrum Studio quality gate (format, lint, type check, Rust and frontend tests) and, when UI behaviour changed, launch the app to confirm the change really works. Use after any significant change and before declaring work complete.
---

# Verify a change

1. `npm run check` — runs, in order: `cargo fmt --check`, `cargo clippy -D warnings`,
   `cargo test --workspace` (also regenerates `src/bindings`), Prettier check, ESLint, `tsc --noEmit`
   (app and e2e), Vitest.
   Fix every failure; do not suppress lints without a written reason next to the `allow`.
2. If a Rust type exported to TypeScript changed, run `npm run bindings` and re-run the check.
3. If the change affects user-visible behaviour, confirm it in the real app:
   - `npm run tauri dev` (X11 session required) and exercise the workflow, or
   - `npm run e2e` when `WebKitWebDriver` is installed (see `docs/testing.md`); failures leave
     screenshots in `e2e/logs/`. Prefer WebDriver over synthetic X input (xdotool clicks are
     unreliable with WebKitGTK). `npm run docs:screenshot` refreshes the README screenshot.
   For UI changes also look at the result: screenshot (`npm run docs:screenshot`, or a WebDriver
   screenshot) with realistic data, long names and a narrow window, open it with the Read tool, and
   check overflow/cropping/alignment. Passing tests do not prove the UI looks right.
4. Update `docs/roadmap.md` status and any affected docs. Only mark a feature done when it works
   end to end and has tests.
