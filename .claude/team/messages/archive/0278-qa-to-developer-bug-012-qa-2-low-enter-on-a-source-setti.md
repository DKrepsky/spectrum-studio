---
id: 0278
from: qa
to: developer
type: bug
subject: BUG-012-QA-2 (low): Enter on a Source settings Hz param drops focus
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:52:38-03:00
---

Summary: after a valid Enter in a Source settings Hz parameter (ParamForm, e.g. Tone 1 Frequency) keyboard focus goes to BODY. The fix pass made FrequencyField keep focus, but ParamForm passes `disabled` while the source is applying (SourcePanel `disabled={busy === 'applying'}`), and a natively disabled input drops focus in WebKit. Center and Span in the Measurement group do not have this problem since they use readOnly.
Severity: minor (low; a11y, DESIGN 9.8). Not a regression: HEAD also blurred on a valid Enter here.
Steps to reproduce: connect the Signal simulator; open Source settings; click Tone 1 Frequency, type 100.3M, press Enter. Read document.activeElement.
Expected: focus stays in "Frequency" after Enter (as Center and Span now do; DESIGN 9.8).
Actual: document.activeElement = BODY. MutationObserver on the field: disabled=true with focus, then focusout, then disabled=false without focus. Value and backend apply are correct (peak P1 moves to 100.30000 MHz).
Evidence: .claude/team/work/012-measurement-center-span/qa.md "Re-test" R13 and BUG-012-QA-2; screenshot .claude/team/work/012-measurement-center-span/screenshots/r2-paramform-focus-after-enter-1440-sim.png (caret visible but no focus ring; trust the DOM probe).
Suspected area: src/components/ParamForm.tsx ParamField Hz branch (pass readOnly while busy, like MeasurementPanel); src/components/panels/SourcePanel.tsx. NumberField, Select and Checkbox in ParamForm are also disabled while applying (same pattern); decide with the PM whether to fix them in 038 or as a candidate issue.
