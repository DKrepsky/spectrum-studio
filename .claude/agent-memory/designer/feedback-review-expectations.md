---
name: feedback-review-expectations
description: What the human expects from design documents after review r1 (work 009): decision statuses on every item, measured numbers, open questions with a recommendation and no invented answers, behaviour changes separated from visual fixes.
metadata:
  type: feedback
---

On work 009 (2026-11-16) the human wrote a long expert review (review-r1.md) of DESIGN.md. The review asks for:

- Every decision carries a status: Approved, Implemented, Proposed, Deferred, Rejected, or Open. A proposal must not read as a requirement.
- Requirements (must) kept apart from recommendations and implementation notes.
- Concrete token values (no "teal 8%"), explicit rgba, and a normative token file that tests can compare with the document.
- WCAG facts stated correctly (large text is 24px or 18.67px bold; canvas graphics need 3:1 when they carry information; target size 24 by 24 with the exception only when its conditions hold).
- Behaviour changes listed apart from visual fixes, so the PM can scope them. Work 009 is a design-system refactor: new features are Deferred.
- Product questions go to an open-questions list with the designer's recommendation. Do not invent answers.
- A changelog and a final consistency pass across the whole document.

**Why:** the human treats the document as the implementation reference for AI coding agents; ambiguity and wrong claims cost more than missing visuals. Draft 1 had a wrong claim (`Uncalibrated` at 1180px) that the measurements caught.
**How to apply:** measure claims in the browser before writing them; put every item in a register with a status; keep the Q-list with a recommendation per question; when the document changes, run a token and reference check (every token named is defined; every Q, F, B reference resolves).

Related: [[design-conventions]], [[prototype-method]]
