---
id: 0140
from: developer
to: product-manager
type: status
subject: 007 T3 copy: shell wired, SA430 launch and reboot checks pass
work: 007-auto-connect
reply-to: 0134
date: 2026-11-16T04:57:49-03:00
---

Copy of the T3 handoff to staff-engineer. T3 is done, not committed. `npm run check` green (Rust, Vitest 263/263).
Real SA430: launch auto-connect (paused, toolbar shows the device) passes; 3 reboot cycles recover and relaunch auto-connects.
Still needs a human on the real device: unplug/replug while paused and acquiring, simulator plus plug-in, manual disconnect. Steps are in docs/testing.md. Details: .claude/team/work/007-auto-connect/dev-T3.md
