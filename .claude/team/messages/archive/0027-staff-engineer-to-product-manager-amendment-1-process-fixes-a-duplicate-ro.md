---
id: 0027
from: staff-engineer
to: product-manager
type: handoff
subject: Amendment 1: process fixes (A) + duplicate-row investigation (B) done
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T12:23:34-03:00
---

A. Process (edited): .claude/team/protocol.md (layout table: prototype/, screenshots/; Definitions: design gate with human-validated prototype, "Visually verified", Done requires screenshots for UI criteria), agents/designer.md (mandatory prototype for major/workflow features with scenario switcher + long/realistic content; minor tweaks must state "no prototype"), agents/qa.md (mandatory visual inspection, screenshots into work/<id>/screenshots/, LOOK via Read, checklist, overflow = bug, bug template + screenshot), skills/feature-lifecycle (design gate: human validates prototype; reject QA reports resting on tests only), skills/verify (look at screenshots). PM definition needed no change (it follows the lifecycle skill).
Automated guard: specified as tasks/T8.md (e2e visual.e2e.ts: scrollWidth<=clientWidth on source button and menu rows at 2 widths, menu inside window, screenshots of key states). Small, e2e-only, runs after the UI rework; add to plan when planning.

B. Investigation: work/001-simplify-source-journey/investigation-duplicates.md. Root cause confirmed from the human's real store (~/.config/io.github.spectrumstudio/sources.json): TWO remembered SA430 entries for one device, one with deviceId=null (auto-picked first device) and one with deviceId="/dev/ttyACM0"; same_identity treats them as different, menuModel only dedupes entries with a deviceId. Root flaw: identity = transient port name and may be absent. Fix: SA430 deviceId = serial; open() reports the resolved id which remember_connected stores; identity match ignores connection; load-time migration merging legacy entries (keeps names); test_source (no session disturbance, InUse if same device active) and add_source (no connect, name required, duplicate-identity error) specified. New ADR 0010 + amendments to 0009/0006 + docs listed (to be written at planning).

Human decisions needed: (1) auto-merge legacy duplicate entries on load (proposed yes, names preserved); (2) Add source: allow Save without a passing Test (proposed yes); (3) USB serial == calibration serial must be verified on real hardware in the first task.
