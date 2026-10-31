# 001 Simplify the source journey
Status: accepted (human, 2026-10-31)

As an RF hobbyist/engineer, I want to pick what I'm looking at (a device, a file, the simulator)
in one place and press Run, so that I never have to understand drivers, "selected vs connected",
or two kinds of saving.

## Problem (current state)
- Switching source touches 4 controls: toolbar Source dropdown, "Sources…" dialog, Connect/Disconnect, Switch.
- "Selected" vs "connected" are separate states (hence Switch). Run already connects, so Connect is redundant.
- Two saves: "Save setup…" (connected source + tuning) vs "Save configuration…" (connection only).
- Dialog is organised by driver kind/transport; saved items, driver types and discovered devices are separate lists.

## Decided journey (human, 2026-10-31)
Decisions: connect on pick; fully automatic remembering (no naming/save step); one menu replaces the Sources dialog.
1. Toolbar shows ONE control: the current source name (e.g. "Signal simulator ▾"). No Connect, Switch or "Sources…" button.
2. Its menu is a single list: Your sources (every source used before, most recent first, auto-remembered),
   Detected devices (auto-scanned), Signal simulator, "Open file…", "Other sources…" (manual connection
   details, e.g. network). Planned/unimplemented drivers are NOT shown anywhere in the UI (human request).
3. Choosing an entry makes it the active source and connects it, replacing any previous one.
   Sources that need details ask only for what's missing, inline.
4. Run/Stop are the only acquisition buttons. "Disconnect" lives in the source menu.
5. Remembering is automatic: connection + last centre/span/device settings are stored per source and
   restored next time. No naming. User can "Forget" an entry and "Rename" is optional (default name is derived from device/file).

## Acceptance criteria
- [ ] Given the app starts, then exactly one source control is in the toolbar; no Connect, Switch or "Sources…" button; no Sources dialog exists.
- [ ] Given a device is plugged in, when I open the menu, then it is listed by name without pressing Scan.
- [ ] Given I pick another source (running or not), then acquisition stops, the new source connects, and the toolbar shows its name — no confirmation step.
- [ ] Given I pick a file via "Open file…", then the file type is chosen automatically and it becomes the source.
- [ ] Given I connected a source and changed centre/span/settings, when I quit and return to it later, then it appears under "Your sources" and reconnects with those settings, without my saving anything.
- [ ] Given a remembered source, when I choose Forget, then it disappears from the list (and is not re-added until used again).
- [ ] Given a failed connection, then the failure message from the backend is shown and state stays Disconnected; the entry is not claimed as connected.
- [ ] Planned (unimplemented) drivers do not appear anywhere in the UI. They stay in the backend registry and in docs/roadmap.md so they are not forgotten.
- [ ] Existing saved sources (sources.json) appear under "Your sources" with their settings; no data loss.
- [ ] Run connects nothing implicitly beyond the active source; Disconnect available from the menu.
- [ ] User guide, unit tests and e2e tests updated; `npm run check` green; e2e passes.

## Out of scope
- New hardware drivers; backend session lifecycle changes beyond what the UI flow needs.
- Multiple simultaneous sources.

## Notes / constraints
- Hiding Planned drivers satisfies the CLAUDE.md honesty rule (nothing unimplemented shown as working); filter in the UI, keep `DriverStatus::Planned` in the backend.
- A saved source whose driver is unavailable/unknown: not listed as connectable (designer/staff-engineer to propose handling, no data loss).
- UI reflects `SessionStatus` only; never assume connect success.
- Driver specifics stay in drivers; the UI keeps rendering forms from ParamSpec.
- Migration of existing saved sources must be lossless.

## Amendment 1 (human feedback at acceptance, 2026-10-31) - supersedes earlier criteria where they conflict
Acceptance of the first build was rejected. Issues found by the human:

1. **"Other sources…" makes no sense. Replace with "Add source…"** (this supersedes "no dialog exists"): opens a
   dialog with: Name; Driver (only drivers that really need manual setup; today only SA430); the driver's
   parameters (today only the serial port); **Test connection**; **Save** / **Cancel**. Save remembers the source
   without making it active/connecting; the user then picks it from the menu.
2. **Duplicated device entry.** A discovered device and its remembered entry must appear as ONE row (the user saw
   two "SA430 08FF41E50F8B3A34"). Renaming a source must survive: when the device is discovered again the system
   recognises it as the same device (needs a stable device identity, e.g. serial number rather than port; this
   promotes the roadmap item "stable device id" into scope; replugging on another port must still match).
3. **Name overflow.** A long connected-device name overflows/crops in the dropdown and looks like a bug. The
   source button and menu rows must lay out long names cleanly at the real widths (design to specify; verified
   visually with screenshots).
4. **Process: QA missed (3).** QA must inspect the real UI visually (screenshots at realistic data, long names,
   real hardware names) and attach evidence; the QA process/agent definition is fixed accordingly.
5. **Process: design flaw.** For major or workflow-changing features the designer delivers a functional HTML
   prototype of the user journey in addition to the spec; the human validates the prototype before engineering.

### Additional acceptance criteria
- [ ] Given the menu, there is "Add source…" (not "Other sources…"); it opens a dialog with Name, Driver (SA430 only), serial port parameter, Test connection, Save, Cancel.
- [ ] Given Test connection, then the result (success or the backend's message) shows in the dialog and the session/active source is not disturbed; Save is possible only with a valid name and parameters.
- [ ] Given a saved source from Add source…, then it appears under Your sources and connects when picked.
- [ ] Given a device is detected AND remembered, then exactly one row represents it (no same-name pairs anywhere in the menu).
- [ ] Given I rename a detected/remembered device, when I unplug and replug it (same or another port), then it shows under my name, as one row.
- [ ] Given a long device name (e.g. "SA430 08FF41E50F8B3A34"), then button and rows show it cleanly at design widths (no unexplained cropping; truncation, if any, is deliberate with full name available) - verified by screenshots.
- [ ] Process docs/agent definitions updated: designer prototype requirement; QA visual-inspection requirement.
