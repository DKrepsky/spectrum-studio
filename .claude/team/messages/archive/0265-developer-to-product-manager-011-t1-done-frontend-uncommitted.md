---
id: 0265
from: developer
to: product-manager
type: handoff
subject: 011 T1 done (frontend), uncommitted
work: 011
reply-to: 
date: 2026-11-17T02:43:07-03:00
---

T1 (frontend) of 011 is done in the working tree, not committed. `npm run check` exit 0; `npm test` 682/682.
Changed: src/state/session.ts, src/state/sources.ts, src/components/source/status.tsx, SourceMenu.tsx; tests in session.test.ts, status.test.ts (new), SourceButton.test.tsx, SourceMenu.test.tsx, NoticeBanner.test.tsx.
Behaviour: a connecting/connected/acquiring status clears the Failed marker and a connect-origin error; Failed shows only while the backend is disconnected. Details and test results in the handoff to staff-engineer. Not yet run in the app.
