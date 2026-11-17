---
name: storybook-a11y-checks
description: How axe runs on the stories (jsdom guard vs real Chrome) and the Storybook/axe gotchas found in 010 rework 2
metadata:
  type: project
---

- `src/ui/stories.test.tsx` runs axe-core in jsdom on every story; `color-contrast` is only "incomplete" there (no layout). Real contrast needs the browser run.
- Browser run recipe that worked: `npm run build-storybook`, serve `storybook-static/` with `python3 -m http.server`, start `google-chrome --headless=new --remote-debugging-port=<p>`, drive it over CDP from a Node script (Node 24 has a global WebSocket), inject `node_modules/axe-core/axe.min.js`, and read per-story a11y params via `window.__STORYBOOK_PREVIEW__.storyStoreValue.loadStory({storyId})`. Without that last step, per-story exemptions are ignored and the run gives false failures.
- A plain `<button>` in a story wrapper gets the UA background and fails contrast; use the `Button` component as the trigger.
- `form` with `role="dialog"` fails aria-allowed-role; the Dialog is a div with the form inside.
- Popover rows: `label-content-name-mismatch` fires when the badge or port is visible but not in the row name. Exempted per story (`BADGE_OUTSIDE_NAME`) pending a PM decision.
- The e2e visual guard had one intermittent failure ("Forget ... did not become interactable") that passed on rerun and alone.
- Why: the human required every story clean or justified (010 rework 2). How to apply: when adding a story with a badge row, check the a11y panel; do not disable rules globally.
