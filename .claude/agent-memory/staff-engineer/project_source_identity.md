---
name: source-identity-rework
description: Why SA430 identity is the serial (not the port), how migration merges, and the non-obvious planning calls of work 001 rework
metadata:
  type: project
---

Work 001 rework (2026-10-31): remembered-source identity is `driverId + deviceId` (SA430 serial, `port:<name>` fallback); the connection (port) is only a hint. `ActiveSource.config` is the *resolved* config, so UI config comparisons must use identity, not full equality. Details in ADR 0010 and `.claude/team/work/001-simplify-source-journey/plan-rework.md`.

**Why:** human saw two identical SA430 rows (one record with deviceId null, one with the port name); the port is transient, the connect path stored no identity.
**How to apply:** any new driver sets a stable `device_id` itself and reports it in `OpenedSource`; never key records on a caller-supplied port. Never merge named presets of non-device sources (simulator/file) during migration. jsdom cannot measure layout, so fixed-width requirements need both a CSS-text Vitest and a real-WebKit e2e measurement.
