---
name: derive-state-from-status
description: Store flags set only inside a store action (receiveStatus/init) are missing when tests setState the status directly; derive UI state from status instead
metadata:
  type: feedback
---

Derive UI start-up/selection state from the store's `status` (plus a flag only the failing path sets), not from a
field that a store action must set. Tests and some components write `useSession.setState({ status })` directly, so a
stored `startup` field stays at its initial value (loading) and unrelated tests show "Loading…".

**Why:** 015 T2 first put `startup` in the store; MeasurementPanel tests then read "Loading…" where they expected the
source name. Deriving with `startupOf(status, startupFailed)` kept one rule and no test churn.

**How to apply:** when adding a UI state that depends on backend status, export a pure function of the status and
any failure flag, and select it in the component. Use `setState` in tests with the status shape, not the action.
