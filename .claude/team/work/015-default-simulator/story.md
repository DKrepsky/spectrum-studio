# 015 — Always have a source selected; simulator fallback

Issue: #46 (the issue is the story and its acceptance criteria)
Status: accepted (2026-11-19)
Path: design note (start-up states) → staff engineer plan (with 014) → developer → review → QA → human physical test with SA430 → acceptance.
Decisions (PM defaults, approved): SA430 replaces the auto-started simulator only while it is idle; never interrupt acquisition; source stays selected after disconnect. Reverses work 007 "simulator never auto-connected".
Design gate (2026-11-19, human): Q-27 failed detected device stays selected in Failed, no simulator fallback; Q-28 OVERRIDDEN: any idle simulator (auto or user-picked) is replaced by a plugged-in device (design R6 must change). PM accepted Q-30 (B3 "Loading…"/"Status unavailable" in scope, closes #3), Q-31, R10, R11.
