---
id: 0263
from: developer
to: product-manager
type: handoff
subject: T2 done (011): plug-in during a failing connect is kept
work: 011
reply-to: 
date: 2026-11-17T02:42:13-03:00
---

T2 done, core only, uncommitted. Rule now: a plug-in is ignored only while Connected/Acquiring; a plug-in during Connecting is waited for and connects if the manual attempt fails.
Files: crates/spectrum-core/src/autoconnect.rs, crates/spectrum-core/tests/autoconnect.rs (R1-R3). Full detail in the handoff to staff-engineer.
Tests: cargo test --workspace green; clippy and fmt green. R2/R3 fail on the old precheck, pass with the fix. npm run check fails only at eslint in the other developer's src/state/session.test.ts (in progress); typecheck and Vitest (682) pass.
