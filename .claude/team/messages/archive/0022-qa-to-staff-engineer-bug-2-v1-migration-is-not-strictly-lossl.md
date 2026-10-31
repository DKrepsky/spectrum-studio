---
id: 0022
from: qa
to: staff-engineer
type: bug
subject: BUG-2 v1 migration is not strictly lossless (unknown fields, names over 80 chars)
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T11:55:58-03:00
---

Summary: After loading a v1 sources.json and the first write, unknown JSON fields on an entry are dropped and names longer than 80 chars are truncated at load. Story requires lossless migration/unknown entries preserved untouched.
Severity: minor (fields unknown to this version are unlikely in real files)
Steps to reproduce: write v1 file with entry {id:ghost, driverId:ghost, extraField:'keep-me'} and another with a 200-char name; start app; forget any entry (forces write); read sources.json.
Expected: ghost entry byte-identical in meaning, incl. extraField; long name kept.
Actual: ghost entry rewritten with defaults added (settings nulls, lastUsedMs) and extraField gone; long name cut to 80.
Evidence: e2e/qa/sw.qa.ts 'P2 hidden intact' output in scratchpad qa-sw.log.
Suspected area: crates/spectrum-core/src/store.rs (typed SavedSource, MAX_NAME_LENGTH truncation at load around line 174). Option: keep unknown entries as serde_json::Value, or accept and document.
