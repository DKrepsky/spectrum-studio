---
name: dialog-busy-error-probes
description: How to force a busy save and a save error in the real app for screenshots (window.__TAURI_INTERNALS__.invoke is not patchable; FIFO and directory tricks at sources.json.tmp)
metadata:
  type: reference
---

- `window.__TAURI_INTERNALS__.invoke` is non-writable and non-configurable in the built app: a page-side
  wrapper for delaying or failing IPC silently does nothing (no error is raised).
- Busy save (real, held open): the store writes `sources.json.tmp` then renames it (store.rs). Make that path a
  FIFO (`mkfifo`) in the wdio run's config dir (`/tmp/spectrum-studio-e2e-*/io.github.spectrumstudio`): the write
  blocks until a reader opens it. Shoot, then open a reader, `rmSync` sources.json afterwards: the rename moves the
  FIFO over sources.json, so the file is a FIFO until removed.
- Save error (real): a directory at `sources.json.tmp` makes `fs::write` fail with EISDIR. Remove it after the shot.
- Probe-only idle detection: Cancel is disabled during a save in both old and new dialogs; `aria-busy` exists only after T10.
- Testing state needs no trick: a test on `/dev/ttyACM9` takes seconds (real identify timeouts).
- A probe that reaches a 1024px step after the FIFO release hit the 90 s mocha timeout in two runs (both builds);
  set `this.timeout` on the probe describe if you need the 1024 save states.
- The FIFO CONSUMES the save: the app's rename moves the FIFO over sources.json, so a reader that discards the data
  loses every remembered source (later fresh sessions see none). Keep `readFileSync(fifo)` and write it back as a
  regular sources.json after the rename (`existsSync(tmp)` false), then the next session still has the rows.
- A second FIFO save in the same app process did not reach the write (the Save never went busy in one run). Use
  `browser.reloadSession()` before each busy save (same config dir, new process).
- A busy save needs a device path no remembered row already uses (`/dev/ttyACM9` twice gives "already in Your sources").
- If the Save never goes busy, the reader blocks forever in `finally`; on a failed busy wait, remove the FIFO instead
  (`rmSync`) and log the dialog's state. Kill your own wdio run by PID only (never `pkill -f`).

**Why:** T10 needed before/after shots of busy and error dialog states that no click reaches.
**How to apply:** only for throwaway probe specs; delete the probe spec and its seed folder afterwards.
