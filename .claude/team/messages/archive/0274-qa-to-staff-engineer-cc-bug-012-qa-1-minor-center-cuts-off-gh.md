---
id: 0274
from: qa
to: staff-engineer
type: request
subject: cc: BUG-012-QA-1 minor: Center cuts off GHz values
work: 012-measurement-center-span
reply-to: 
date: 2026-11-18T01:29:20-03:00
---

Summary: Center field cuts off values of 1 GHz and above (`5.999000000 GHz` loses the `z`) at 1024 and 1440 px. Regression at 1440 (old toolbar field was 150 px, now 130 px).
Severity: minor
Steps to reproduce: connect the Signal simulator; in Measurement, type 5999M in Center and press Enter (or press ArrowUp from 5.9 GHz). Look at the Center field at 1024 and 1440.
Expected: whole value and unit visible (design 3.6, 4.4; no unmarked cropping).
Actual: scrollWidth 132 > clientWidth 128 at both widths; the right end (z of GHz) is clipped.
Evidence: .claude/team/work/012-measurement-center-span/screenshots/center-6000M-1024-sim.png (crop magnified: GHz clipped), .claude/team/work/012-measurement-center-span/screenshots/center-6000M-1440-sim.png; full report .claude/team/work/012-measurement-center-span/qa.md (BUG-012-QA-1).
Suspected area: src/ui/Field/Field.css (.ui-field--inline .ui-field__input--frequency, --field-width-inline 130px). The visual.e2e Center guard only tests 100 MHz; add a GHz case. SA430 range is at most 928 MHz, so the real device is not affected.
