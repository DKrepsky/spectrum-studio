# 003 Play/Pause acquisition button
Status: accepted
As a user watching a spectrum, I want a single icon-only Play/Pause button instead of the Run/Stop
button and the session-state label, so that the toolbar is calmer and freezing the trace is one click.

## Acceptance criteria
- [ ] The state label pill ("Disconnected", "Connecting…", "Connected", "Acquiring", "Disconnecting…")
      is gone from the toolbar. The SIMULATED badge stays. Connection state remains visible via the
      source button's status glyph and its accessible name.
- [ ] The Run/Stop button is replaced by one icon-only button in the same place: a Play icon (no
      "Run" text) when connected and not acquiring; a Pause icon (no text) while acquiring.
- [ ] Pressing Play starts acquisition (backend `start`); the icon becomes Pause only once the backend
      reports `acquiring` (UI reflects SessionStatus, never assumes).
- [ ] Pressing Pause stops acquisition (backend `stop`): no new frames arrive, the last trace stays on
      screen frozen (not cleared), icon returns to Play. Play again resumes with the same settings.
- [ ] The button is disabled when no device is connected (state disconnected, including after device
      lost or with a remembered-but-not-connected source) and while connecting/disconnecting/starting/
      stopping. Play no longer auto-connects.
- [ ] Accessibility: aria-label "Start acquisition" / "Pause acquisition" (+ matching tooltip; disabled
      tooltip "Connect a source first"); keyboard focusable, Space/Enter activate; visible focus ring.
      Icons are inline SVG or glyphs that render on WebKitGTK; button is square, same height as the
      source button, no layout shift between Play and Pause.
- [ ] Unit tests (Toolbar) and e2e specs updated for the new contract; `npm run check` passes.

## Out of scope
A display-only freeze that keeps acquiring in the background; keyboard shortcut for play/pause;
any change to the source menu.

## Notes / constraints
- Pause == existing stop acquisition; no new backend state, no binding changes expected.
- Small tweak fast path (no designer/prototype): dev → visual QA with screenshots → human acceptance.
