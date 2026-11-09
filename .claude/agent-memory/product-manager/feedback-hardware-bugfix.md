---
name: feedback-hardware-bugfix
description: Hardware reliability bugs (work 004 SA430 connect): state defaults, skip designer, staff-engineer root cause → dev → review → QA → human replug
metadata:
  type: feedback
---

For a hardware reliability bug with no UI change (work 004, SA430 failing on first connect after plug-in), the flow
story with stated defaults → staff-engineer root-cause probe on the real device → one developer task → staff-engineer
review → QA on real hardware → human physical test → "Accept and commit" worked in one round; the human accepted.

**Why:** the staff engineer reproduced the plug-in failure without replugging (`Sa430::reboot()` re-enumerates), which
made the fix testable by agents; only the physical replug needed the human.
**How to apply:** for device bugs, ask for root cause with real-device evidence before any fix (not blind retries);
make QA simulate the physical event where possible; end with one AskUserQuestion that bundles the human's physical
test with accept/commit options. Related: [[feedback-small-tweaks]], [[feedback-acceptance-process]].
