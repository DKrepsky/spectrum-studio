---
name: project-no-file-features
description: Human dropped all file functionality (open file, export CSV, file replay sources, finite/EndOfStream contract) as of 2026-11
metadata:
  type: project
---

As of 2026-11-08 the human decided Spectrum Studio supports no file features: no Open file, no CSV export, no file-replay sources (trace-csv, iq-file), and no finite-source / EndOfStream contract. All of it was removed, not hidden (ADR 0011).

**Why:** human said "we will not support open file nor export file for now", then asked to drop dead code and everything file-related.

**How to apply:** don't propose file import/export features unless the human reopens it. If it returns, it's a fresh story, not a revert. The human prefers full removal of dead code over leaving unused contract pieces "for later".
