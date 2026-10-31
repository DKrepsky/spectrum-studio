---
name: project-source-journey
description: Work 001 simplified source management into one toolbar menu with automatic remembering; decisions and lessons
metadata:
  type: project
---

Work 001 (2026-10-31): replaced Sources dialog/selector/Connect/Switch with one source button + menu,
connect on pick, fully automatic remembering (ADR 0009), Planned drivers hidden from the UI.

**Why:** the human found source management overly complex; wants simple, clean journeys.
**How to apply:** prefer fewer concepts and controls; the human approves recommended options and gives short,
principled comments (e.g. "remove unsupported drivers from the screen"). Reject agent deviations from an
approved design unless essential, and give them a testing alternative (seeded config files).

Process lessons: developers' claims conflict (SA430 attached or not) - make QA establish facts; run
`npm run check` myself before acceptance; developers report to staff-engineer but only the PM can spawn, so
the PM relays reviews. Flaky-test root cause was fractional-ms timestamps.

Outcome (2026-10-31): accepted on round 3 after the human rejected rounds 1-2. Prototype + screenshot review at design gate and pixel-measuring
e2e guard (e2e/specs/visual.e2e.ts) now exist; PM views key screenshots (incl. smallest window 1024, real device name acquiring) before asking
for acceptance. Open follow-ups are listed in docs/roadmap.md (BUG-2, newer-version sources.json overwrite, stale banner after Forget, replug/unplug unverified).
