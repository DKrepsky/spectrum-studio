# ADR 0003 — Binary frames pulled by the UI

Status: accepted (2026-10-25)

## Context

At 30 frames/s with up to 32768 bins and three traces, JSON event payloads would serialise
several MB/s of text and stress the webview's main thread. Pushing frames also needs explicit
back-pressure when the UI is slower than the source.

## Decision

- Frames are encoded once on the acquisition thread as raw bytes:

  ```
  u32 LE  header length H
  H bytes UTF-8 JSON header (FrameHeader: settings, unit, frequency axis, peaks, flags)
  pad     zero bytes to a 4-byte boundary
  f32 LE  `bins` values per trace, traces in the order listed in header.traces
  ```

- The UI **pulls** frames with the `next_frame(after_seq)` command, which long-polls (≤ 500 ms) for
  a frame newer than `after_seq` and returns it as a raw `tauri::ipc::Response` (an `ArrayBuffer`
  in JavaScript), or an empty body on timeout.
- The backend keeps only the latest frame (latest wins). A slow UI simply skips frames; nothing
  queues up and latency stays bounded.
- Status and errors (low rate) are pushed as JSON events (`session-status`).

## Consequences

- Natural back-pressure without extra protocol; one request per displayed frame (sub-millisecond
  IPC overhead).
- `src/ipc/frame.ts` validates lengths and header fields and rejects malformed messages; it is
  tested against a fixture produced by the Rust encoder.
- The latest frame stays available after stopping, which is what *Export CSV* writes.
