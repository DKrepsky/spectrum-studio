# 013 — Outcome

Issue: #40 — **Accepted** by the human 2026-11-18.

- Device selector is the first item and capture control the last of the Measurement group; toolbar is brand only.
- Human decision: capture control is not sticky (scrolls with the panel); documented in DESIGN.md.
- QA findings fixed in the same change: capture menu flips upward when it doesn't fit (200% zoom), DESIGN status bar 24 px,
  failed source accessible name says "Failed", FFT size/Window disabled with a reason when no source is connected.
- Evidence: qa.md (initial + Re-verification), screenshots/. `npm run check` green; e2e 11/11 spec files.
- Follow-ups: #41 (popover 1 px at 200%), #42 (visual.e2e flake), #43 (e2e helper states).
