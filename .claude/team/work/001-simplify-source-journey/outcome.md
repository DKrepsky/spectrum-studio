# 001 Outcome (rework, round 3)
Status: accepted (human, 2026-10-31)

History: round 1 rejected by human (Other sources nonsense, duplicate device row, cropped name); QA round 1 missed the visual
defect -> process fixed (prototype for major UI, visual QA with screenshots, pixel guard). Rework built on the approved prototype.
Round 2 QA found R2-1 (duplicate after untested Add), R2-2 (60-char name overflowed window at 1024), R2-3 (forgotten name stayed);
PM found T19 (22-char name cropped at 1024 acquiring). All fixed.

Evidence: PM ran `npm run check` -> exit 0 (202 frontend tests; Rust suites). PM viewed screenshots: real SA430 acquiring at 1024
shows "SA430 08FF41E50F8B3A34" in full; 22-char simulator name in full with SIMULATED badge; hover actions under the badge; one row
per device after untested Add. Developers report `SPECTRUM_E2E_SA430=1 npm run e2e:run` 10/10 spec files on the real SA430, and the
pixel guard fails when the fixed widths / toolbar CSS are reverted.

Not verified: replug on another port; unplug mid-run on SA430; "different device on this port" state (needs 2 analyzers); native
Open file… dialog by hand; well-formed newer-version sources.json only covered by a Rust test.
Open minor: stale error banner after forgetting a failed source; BUG-2 (unknown JSON fields dropped in v1 migration; backup mitigates);
newer-version file is overwritten as v3 on the next change.
Real config: ~/.config/io.github.spectrumstudio/sources.json is already v3 (duplicates merged, backup sources.pre-v3-1793465779125.json);
which run migrated it is unknown (QA says it did not write there).
