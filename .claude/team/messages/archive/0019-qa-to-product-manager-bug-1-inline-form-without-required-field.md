---
id: 0019
from: qa
to: product-manager
type: bug
subject: BUG-1 inline form without required fields: focus lost, Escape does nothing
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:55:58-03:00
---

Summary: Opening the inline details form for a driver with no required parameter leaves keyboard focus on BODY, so Escape (and arrow keys) do nothing; a keyboard user is stranded in the open popover. Design section 4/6 says Escape returns to the list and focus goes into the form.
Severity: minor (a11y; major if keyboard use is a must-have)
Steps to reproduce: fresh config, SA430 attached. Open source menu, choose 'Other sources...' (single driver goes straight to the SA430 form). document.activeElement is BODY. Press Escape.
Expected: Escape returns to the list; focus inside the form (first field / Connect / Back).
Actual: form stays, menu stays open, focus BODY. Clicking Back works and focus then lands on the first list item.
Evidence: e2e/qa/sw3.qa.ts log 'QA focus in form: BODY|null', 'after Esc: form?: true' (scratchpad qa-sw3.log).
Suspected area: src/components/source/SourceMenu.tsx / SourceForm.tsx initial focus effect (focus only moves to a required field; nothing otherwise). Likely any form without required params, e.g. Open file for an IQ file with defaults.
