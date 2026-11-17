---
name: feedback-design-spec-review
description: Human reviews design documents in depth themselves before answering decision questions; expects spec-grade rigor (WCAG accuracy, ARIA semantics, governance)
metadata:
  type: feedback
---

On work 009 (2026-11-16) the human rejected my design-gate AskUserQuestion (fix list, copy, outline choices) and
instead pasted a long expert review of DESIGN.md: WCAG corrections, menu vs popover semantics, live regions, valid CSS
token values, plot/visualization spec, performance/measurement integrity, responsive ranges, authority hierarchy,
decision statuses, changelog.

**Why:** they treat DESIGN.md as the implementation reference for AI agents, so ambiguity and wrong a11y claims matter
more than the small visual fixes. Gate questions about details were premature while the document itself wasn't right.
**How to apply:** for spec/document deliverables, present the document for review first, then ask about the remaining
decisions. Save their review verbatim in the work folder (review-rN.md) and hand it to the designer as the brief.
Expect them to want specs that leave an agent with no UX decisions to make. See [[feedback-acceptance-process]].

Follow-up (same day): after reviewing draft 2 the human said "I trust you to take the best decision regarding the open
items" — PM decided all 22 open questions (mostly the designer's recommendations; behaviour changes pushed to backlog
to keep the refactor pure) and recorded them in work/009/decisions.md. **How to apply:** once the document is right,
the human is happy to delegate detailed design decisions; record them in a decisions file rather than asking each one.
