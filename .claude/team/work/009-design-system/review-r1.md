# Human review r1 of DESIGN.md (2026-11-16) — verbatim

# Prompt: Review and Improve the Spectrum Studio Design Specification

Act as a senior product designer, UX architect, and design-system specialist with experience designing professional desktop applications and scientific instrumentation software.

Review and improve the existing **Spectrum Studio design specification** based on the requirements below.

The goal is **not to redesign the application or replace its established visual direction**. The current specification is already strong. Preserve its instrument-oriented philosophy, dark visual language, information density, keyboard-first interaction model, semantic design tokens, and separation between presentation and application/hardware logic.

Focus on resolving ambiguities, correcting accessibility and interaction issues, and filling gaps that could lead to inconsistent implementation by AI coding agents.

## 1. Critical corrections (P0)

Address these issues first:

### Accessibility and WCAG compliance
- Correct the WCAG large-text definition. Text qualifies as large text at 24 CSS px regular or approximately 18.67 CSS px bold. The current 15px semibold threshold is incorrect. Text below these thresholds must meet normal-text contrast requirements (4.5:1).
- Review all text and graphical contrast requirements, including spectrum traces, grid lines, axes, markers, and other essential graphical elements. Canvas-rendered content is not automatically exempt from non-text contrast requirements.
- Do not rely on color alone to distinguish traces or measurement states. Consider line styles, widths, markers, and legends.
- Revisit disabled-control opacity values (0.45 and 0.55). Ensure disabled text and controls remain sufficiently legible.
- Define the missing focus-ring tokens, including `--focus-ring-width` and `--focus-ring-offset`, with concrete values.
- Do not assume users will always operate the application at 100% display scaling. Define and test behavior at 100%, 125%, 150%, and 200% text enlargement or scaling where supported.
- Review target sizes and spacing against WCAG 2.2 requirements. Prefer actual 24 × 24 CSS px targets; apply the spacing exception only when its geometric conditions are satisfied.

### Menus and popovers
- The current source menu combines menu semantics with interactive forms, buttons, and connection controls. This is not an appropriate use of `role="menu"`.
- Use a general-purpose popover with appropriate list semantics and ordinary interactive controls for the source selector.
- Reserve conventional menu semantics for actual command menus, such as the capture-mode selector.
- Correct keyboard behavior:
  - Escape closes the popup and restores focus to its trigger.
  - Tab closes the popup and allows focus to continue through the document.
  - Do not trap focus in a simple menu or popover unless it is explicitly a modal interaction.

### Announcements and live regions
- Do not assign `role="alert"` to every banner.
- Use assertive announcements only for urgent errors that require immediate attention.
- Use polite status announcements for routine notifications and non-critical state changes.
- Avoid duplicate announcements when the same state is already represented by another live region.
- Clarify the difference between information that must remain visually visible and information that must remain available to assistive technology.

### CSS token correctness
- Fix invalid or ambiguous token values, particularly the scrim definition currently expressed as `rgba(0, 0, 0, 0.5 / 0.6)`.
- Use valid CSS color syntax and separate tokens when multiple opacity values are required.
- Replace abstract descriptions such as "teal 8%" and "amber 12%" with actual CSS values or explicit derivation rules.
- Ensure all referenced tokens are defined and have a clear source of truth.

## 2. Improve interaction specifications

Make interaction behavior explicit enough that an implementation agent does not have to invent behavior.

### Source selector lifecycle
Expand the source selector specification to cover:
- Initial device discovery.
- Available, remembered, and detected sources.
- Device connection and disconnection.
- A device disappearing during acquisition.
- Duplicate or ambiguous device detection.
- Connection testing and failure.
- Cancellation and retry behavior.
- Source selection and switching while a capture is active.
- Loading, empty, unavailable, and error states.

Clearly distinguish UI state from backend/device state. The UI must reflect actual backend state rather than independently assuming that a connection or capture succeeded.

### Readout table and measurement selection
The specification mentions keyboard selection but does not fully define it.

Specify:
- Row selection and focus behavior.
- Keyboard navigation.
- Selection of peaks and markers.
- Multi-selection, if supported.
- How selection relates to the spectrum plot.
- What happens when a selected measurement disappears or is updated.

### Tooltips and contextual controls
Add a complete tooltip specification:
- Hover delay and dismissal behavior.
- Keyboard-focus behavior.
- Touch-device behavior.
- Placement and collision handling.
- Maximum width and text wrapping.
- Accessible descriptions and relationships to their triggering controls.

Also define reusable interaction patterns for segmented controls, tabs, context menus, confirmation dialogs, progress indicators, and keyboard-shortcut hints where they are relevant.

## 3. Expand the spectrum visualization specification

This is one of the most important missing areas.

The spectrum plot is the application's primary instrument interface and deserves a dedicated, detailed specification.

Define the expected behavior and visual representation of:

- Live trace.
- Maximum-hold and minimum-hold traces.
- Grid lines and frequency/amplitude axes.
- Frequency and amplitude labels.
- Markers and peak detection.
- Crosshair and cursor readouts.
- Stale or frozen traces.
- Waterfall visualization, including color scale and dynamic range.
- Trace visibility and differentiation.
- Measurement updates and transitions between capture states.

Specify how the user interacts with the visualization. Consider the following interactions and establish which should be supported:

- Click to place or select a marker.
- Shift-click to add a marker.
- Cursor movement and crosshair readout.
- Mouse-wheel zoom.
- Drag to pan or select a frequency range.
- Keyboard-based marker movement and adjustment.

These are proposed interaction patterns, not assumptions that every one must be implemented. Evaluate them and document the final decisions.

The specification must also make clear that measurement data must not be visually manipulated in ways that imply accuracy that the underlying data does not provide.

## 4. Define performance and measurement-integrity expectations

Spectrum Studio is an instrument-oriented application. Measurement integrity and predictable behavior are more important than decorative animation.

Add explicit performance requirements covering:

- No interpolation or smoothing that misrepresents measurement data.
- Stable axes and layout during continuous acquisition.
- No unnecessary React re-renders caused by high-frequency measurement updates.
- No avoidable layout shifts.
- Defined behavior when the backend produces data faster than the renderer can display it.
- Appropriate buffering, throttling, or frame-dropping strategies.
- Clear distinction between live, frozen, stale, and unavailable measurement data.
- Consistent measurement formatting and units.

Preserve the distinction between physical measurements, display formatting, and calibration-dependent values such as dBm and dBFS.

## 5. Refine responsive desktop behavior

The current specification defines a minimum desktop window size of 1024 × 640, a default size of 1440 × 900, and a 330px side panel.

Make the behavior more concrete across these ranges:

- 1440px and above.
- 1180–1439px.
- 1024–1179px.

Evaluate the actual space required by the toolbar, including long source names and device identifiers. Do not assume that all controls will fit simply because the default window size is large.

Define:
- Which controls can collapse or move into overflow menus.
- Which information must remain visible.
- How the side panel behaves when space is constrained.
- What happens when the panel reaches its minimum width.
- Which status-bar elements have priority when space is limited.

Remove assumptions that the application will not be zoomed or display-scaled.

## 6. Clarify design-system architecture

Establish a clear source of truth for design tokens and their use.

The specification should explain how tokens are shared across:
- CSS and React components.
- Canvas-based spectrum rendering.
- Tests and visual regression checks.

Canvas rendering must consume centrally resolved design-system values rather than maintain a duplicated palette.

Ensure that semantic tokens represent intent rather than merely duplicating primitive color names.

Define how new components and states should use the existing token system.

## 7. Resolve specification inconsistencies

Review the entire document for contradictions and ambiguous statements.

In particular:
- Clarify status text that is described as "always shown" when some states currently specify no visible status.
- Define fallback behavior when controls or labels cannot fit within their minimum dimensions.
- Ensure component states, interaction rules, and accessibility requirements agree with each other.
- Make sure every referenced token, component, and interaction pattern has a corresponding definition.
- Distinguish requirements from recommendations and implementation suggestions.

Do not silently remove existing requirements. If a requirement is incorrect or should change, explain the reason and document the replacement.

## 8. Establish design-specification governance

Make the document reliable as an implementation reference for AI coding agents.

Define a clear hierarchy of authority between:
1. The approved design-system specification.
2. Component inventory and implementation/migration documentation.
3. Visual prototypes and previews.
4. Design tokens and their implementation source.
5. Architecture Decision Records (ADRs).

A prototype must not silently override an approved specification.

Add document metadata such as:
- Version.
- Last updated date.
- Specification status.
- Scope.
- Relevant dependencies.

Where useful, classify decisions as:
- Approved.
- Proposed.
- Deferred.
- Rejected.
- Implemented.

This will prevent agents from treating suggestions or incomplete prototypes as established requirements.

## 9. Expected deliverables

After reviewing the existing document:

1. Produce a revised, complete design specification incorporating the improvements above.
2. Preserve existing valid requirements and established design decisions.
3. Do not introduce unnecessary complexity or speculative features.
4. Clearly document decisions where behavior was previously ambiguous.
5. Identify unresolved questions rather than inventing answers.
6. Include concrete examples, token values, interaction rules, and accessibility requirements wherever possible.
7. Ensure the result is actionable by an AI coding agent without requiring it to make significant UX or design-system decisions independently.
8. Include a concise changelog explaining the most important changes and why they were necessary.

## Guiding principle

**Spectrum Studio is a measurement instrument, not a generic dashboard.**

The interface must prioritize measurement integrity, information clarity, predictable interaction, accessibility, and operational efficiency.

Do not sacrifice technical correctness for visual polish. Do not turn the application into a generic SaaS dashboard. Preserve its existing visual identity and improve the precision, completeness, and implementation-readiness of the specification.

Before considering the work complete, perform a final consistency review across the entire revised document. Ensure that its design tokens, component definitions, interaction patterns, accessibility requirements, and implementation guidance do not contradict one another.
