---
id: 0038
from: staff-engineer
to: product-manager
type: handoff
subject: Rework plan ready: T9-T16, ADR 0010
work: 001-simplify-source-journey
reply-to: 
date: 2026-10-31T13:04:30-03:00
---

Plan: .claude/team/work/001-simplify-source-journey/plan-rework.md. Tasks: tasks/T9..T16.md (requests 0030-0037 to developer). T1-T7 marked built/partly superseded, T8 obsolete (replaced by T16). ADR 0010 written; ADR 0009 and 0006 amended.

ORDER / PARALLELISM
T9 (contract types, small, first) -> [T10 SA430 identity + hardware check | T11 store/migration/add/update | T13 frontend IPC+state+mock+dialog stub] in parallel -> [T12 test_source + Tauri commands + wiring (needs T9,T10,T11) | T14 menu/glyphs/fixed widths/Add source (needs T13) | T15 Add/Edit dialog (needs T13)] in parallel -> T16 e2e + visual guard + screenshots + docs.
File ownership is disjoint per task (table in plan section 6). Frontend works against mockApi until T12 lands.

FIRST VERIFICATION (T10 step 1): hardware test that the USB serial equals the calibration serial on the attached SA430. Evidence so far says equal (udev ID_SERIAL_SHORT = 08FF41E50F8B3A34 = label written by open). If not, fallback is decided (derive id from the scan data), so only T10 is affected; the developer reports immediately.

DECISIONS I MADE (PM please confirm or overrule; none needs the human)
1. Migration merges only (a) device entries with the same driver+serial, (b) non-device entries with the same driver+connection+displayed name. Distinct named presets (simulator/file) are NEVER merged (lossless). This also fixes QA BUG-3. If two merged device entries carry different user names, the most recently used name wins, the other survives only in the backup file sources.pre-v3-<ms>.json, and a start-up warning says so.
2. Refinement of your "untested port change" decision: identity wins over the edited port. If the original SA430 is still attached, connect uses it (port refreshed). The expected-vs-found failure appears when the original is not found and the typed port holds another device. Reason: never connect the wrong device AND never refuse a device that is present. Say if you want strict "always fail on mismatch" instead.
3. One command `add_source` serves both Add source... and remembering a detected device from Edit (no separate upsert). `rename_source` removed; `update_source` covers rename/params/rebind. Connected-source lock is enforced in Rust too (name-only edits allowed).
4. SA430 driver transport changes Serial -> Usb so the badge reads USB as designed. Driver name shown in the dialog is the backend's ("TI SA430 spectrum analyzer"), not the prototype's shorter text.
5. In the dialog every connection param is required (a record needs a handle) even though the SA430 ParamSpec keeps required:false for the connect-from-detected path.
6. test_source never touches the session: same-port-as-active returns ok:false/in_use, a connect in progress returns Busy, 8 s timeout.

RISKS
- ActiveSource.config is now the resolved config (serial + port filled in). UI code comparing configs must use the new sameIdentity (T13); persistence/reconnect e2e cover it.
- Migration: backed up before rewrite; BUG-2 (unknown JSON fields dropped by round trip) remains, mitigated by the backup. Legacy port-only entries with the device unplugged at startup show Not detected + New until first connect (documented).
- Menu row is now a grid on a button with an absolutely placed actions slot; jsdom cannot measure, so widths are guarded as CSS text in Vitest (T14) and as real pixels in the T16 e2e guard (must fail when the 64px column is reverted).
- Dialog a11y (focus trap/return) is the largest UI risk; keyboard tests are in T15.
- T12 first exercises the real commands only in T16 (frontend uses the mock until then): budget QA time on the real app after T16.

HUMAN: nothing blocking. Only if you want to overrule decision 2 (strict mismatch failure).
