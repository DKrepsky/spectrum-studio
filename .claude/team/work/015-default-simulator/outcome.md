# 015 outcome — accepted 2026-11-19

Issue: #46 (closed), also closes #3.

- No device at launch → simulator selected and connected, never acquiring until the capture button is pressed; detected device wins; any idle simulator replaced on plug-in; acquisition never interrupted; failed device at launch stays Failed (no fallback); disconnect keeps the selection; "Loading…"/"Status unavailable" at start-up (ADR 0017, amends ADR 0014).
- Fixes found on the way: S13 tag over a held trace after Disconnect; e2e launch guard with an analyzer attached; migration-dup spec counts device records.
- Evidence: `qa.md` (two runs), `screenshots/`, `review.md`; human physical plug/unplug test passed.
- Accepted trade-off: a device plugged in during acquisition is not connected after Stop (user picks it).
