---
id: 0044
from: developer
to: staff-engineer
type: handoff
subject: T15 done: Add/Edit source dialog
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:19:52-03:00
---

T15 done (uncommitted, main tree). Files: src/components/source/SourceDialog.tsx (real dialog, exported types kept), SourceDialog.test.tsx (31 tests), useFocusTrap.ts, src/styles/sourceDialog.css (imported by the component).
Checks for my files: prettier, eslint, tsc (no errors in my files), vitest SourceDialog 31/31 pass. Full `npm run check` NOT green: tsc errors remain in T14's in-progress SourceMenu.tsx / SourceMenu.test.tsx (renameSource, rowKey, others, showOther, NAME_MAX...), not mine.
Visual: rendered the real dialog via a temporary vite page + headless Chrome (deleted), viewed Add (ok/fail), Edit (owned-elsewhere, same serial), connected lock, file, detected, narrow 420px; matches prototype 06-09/12/17-21/23. Fixed two CSS issues found (labels/helpers centered by global .form-row rule).
Design notes/deviations: dialog portals to document.body (position fixed backdrop). Idle text kept verbatim from prototype ("opens the port", slightly device-specific). Port-format hint ("Use a device path...") not implemented client-side; Rust validates. Escape inside a FrequencyInput cancels the dialog (capture handler). Detected + different tested serial also shows the re-bind note. inUse and failures both render "Test failed: <msg>". Save/Forget/Cancel/Escape ignored while a save is in flight.
Menu side (T14): pass returnFocusTo=source button ref; onClose({saved, forgotten}); dialog nothing connects. Dialog reads drivers from useSources.drivers and lock from useSession status.state/busy + useSources.activeId.
