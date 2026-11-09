---
id: 0070
from: qa
to: staff-engineer
type: bug
subject: BUG-1 (cc): Keyboard focus lost after Play/Pause activation
work: 003
reply-to: 
date: 2026-11-09T00:10:24-03:00
---

Summary: Keyboard focus is dropped from Play/Pause after every activation, so Space/Enter cannot be used repeatedly.
Severity: major
Steps to reproduce: Run the app (Simulator), connect, Tab to Play (blue ring), press Space (Acquiring), Tab back to Pause, press Space. Focus is on BODY after each activation.
Expected: Focus stays on the Play/Pause button across activations; Enter/Space keep working on it. Visible focus ring stays.
Actual: The button becomes disabled while the command is in flight (`disabled={acquireDisabled}`, busy !== null). WebKit moves focus to BODY at the moment the button is disabled; once re-enabled it does not regain focus. A second Enter/Space does nothing.
Evidence: screenshots/focus-lost-after-keyboard-pause-1024-sim.png (no ring); evidence/screens-log2.json (afterSpacePause BODY); evidence/qa-focus-run1.log and evidence/qa-focus-current.log (focusout on acquire-button 36-73 ms after disabled=true at 31-71 ms; 3 of 3 traces). Inherited: baseline Run/Stop has the same drop (evidence/qa-basefocus.log).
Suspected area: src/components/Toolbar.tsx (acquireDisabled includes busy). Suggested fix (not applied): do not set the disabled attribute for in-flight busy states; disable only when !canAcquire, and ignore clicks while busy in toggleAcquisition (or aria-disabled). Add a test that focus is retained after Space/Enter (a keyboard test, no mocked focus).
Full QA: .claude/team/work/003-play-pause-button/qa.md
