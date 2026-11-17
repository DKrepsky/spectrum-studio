# T5b Button busy keeps its width (must land before T6)

Goal: DESIGN.md 4.1: `busy` never changes the button width. Today (src/ui/Button/Button.tsx) the spinner is a leading slot that widens a label-only button.
Dependencies: T3. Parallel: yes with nothing else (T6-T10 use busy buttons; merge first).
Files: `src/ui/Button/Button.tsx`, `Button.css`, `Button.test.tsx` only.
Work: keep the label and the width stable, with no layout shift. Preferred: when there is no `icon`, overlay the spinner (absolutely positioned, centred over a visibility-hidden label that keeps its box); with an `icon`, the spinner replaces it in the same 12px slot. `aria-busy` and the visible label stay (the label may be visually hidden only if the accessible name is unchanged; prefer `visibility: hidden` on a wrapper while the spinner shows, with `aria-hidden` unset on nothing: the name must still be the label).
Acceptance: `npm run check`; a test that renders the same Button idle and busy (with and without icon) and asserts the structure keeps the label node and the CSS contract (no width-changing leading slot: assert the spinner is `position: absolute` when there is no icon); manual screenshot of Save busy in the dialog is part of T10.
