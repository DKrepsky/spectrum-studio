---
name: measurement-cache-tests
description: MeasurementPanel tests must reset capabilitiesByDriver; a cache from an earlier test enables rows that a fresh run would not show
metadata:
  type: feedback
---

The session store keeps `capabilitiesByDriver` for the whole run (014 T3). Every `beforeEach` that
resets `useSession` for MeasurementPanel or SourcePanel tests must also set `capabilitiesByDriver: {}`,
or the previous test's simulator/SA430 kind leaks in (Center enabled with no source, FFT rows present).

**Why:** the first MeasurementPanel run after adding the cache failed in a way that looked like a
rendering bug; the cause was test state, not the component.

**How to apply:** when a test expects a source that was "never opened this run", reset the cache in
`beforeEach`. Also remember: Center and Span need `source === null` in `disabled`, not just `!caps`.
