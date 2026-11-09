# Plan 004 — Reliable SA430 connection after plug-in

## Root cause (reproduced on the real device, 2026-11-09)

Reproduction without replugging: `Sa430::reboot()` (CMD_HW_RESET) makes the device re-enumerate
exactly like a plug-in (node disappears ~2 ms, reappears ~670 ms later). Then, with the `sa430`
0.2.0 library as the driver uses it:

1. connect #1 -> `Device { FlashRead, NoFrameStart }` in ~3 ms (the exact user error)
2. connect #2 -> `Io(TimedOut)` after 5.0 s
3. connect #3 -> OK

Facts established with a raw `serialport` probe (scratch crate, not committed):

- **Trigger: the first command written within ~<20 ms of opening the port after enumeration.**
  `sa430::channel::SerialPortChannel::new` (channel.rs:59-71) opens the port, calls
  `clear(Input)` and returns; `Sa430::calibration()` (device.rs:290/304) then immediately sends
  `FlashRead` (protocol.rs `read_flash`, send_frame:162). Sending the same frame 0 ms after open
  => the device answers with two NACKs `2A 02 06 03 2D ..` (0x032D "No frame start") and
  `0x0326` instead of ACK+data. Waiting 5, 10, 20, 100 or 300 ms after open before the first
  write => correct ACK+data every time (5 runs each side). Warm re-opens (device not just
  enumerated) work with 0 ms, so the device needs a short moment after the *first* open (CDC
  line-state/line-coding handling) and mangles frame bytes that arrive earlier.
- **After the corrupted frame the device is left desynchronised**: each following request gets
  no reply, the next one gets two replies (one frame late), and so on, indefinitely (10 frames
  checked). This is why connect #2 times out: `receive_frame` (protocol.rs:~186) waits for an ACK
  that only comes after the *next* frame, and `SERIAL_PORT_TIMEOUT` is 5 s (channel.rs:40).
- **What heals it**: after the glitch, one more request that is left unanswered, then close and
  re-open the port; the next open is clean (also with a settle delay on the re-open). This is
  exactly what happens to the user's attempt #2 -> #3. Re-opening right after the glitch alone,
  without that extra frame, did NOT heal (device stayed one reply behind); sending Sync frames
  or flooding zeros to resync is unreliable (stray error frames pollute later reads), as is
  waiting in silence (300-1200 ms). So no in-band "resync" exists; the practical ladder is
  settle first, otherwise close/re-open and re-try (see below).
- Also seen: right after the node reappears `open` returns `PermissionDenied` for a few ms
  (udev ACL not applied yet). Real plug-in then connect is usually later, but a retry on it is
  cheap and the final message must keep the dialout hint.
- Not the cause: unsolicited bytes at open (none observed), device boot time (open at 690 ms is
  fine), `clear(Input)` (already done by the library), port left open (the app drops it).
  In the library's own flow `Sa430::open` hard-codes the 5 s read timeout and no settle delay;
  the library has no hook for either.

## Approach (all inside the driver crate; no change to the `sa430` crate, no fork)

`spectrum-driver-sa430` stops using `Sa430::open` for real hardware. `SerialBackend::open`
builds the channel itself and hands it to `Sa430::new(Box<dyn Channel>)` (public API; the
`Channel` trait is blanket-implemented for any `Read + Write + Send`). Retry and policy live in
`Sa430Driver::open`, so the scripted `Sa430Backend` in tests still drives the same path.

1. **Settle delay** (the actual fix): `SerialBackend::open` opens with `serialport` at 926100
   baud 8N1, no flow control (same settings as the library, channel.rs:36-40), sleeps
   `SETTLE = 200 ms` (>10x the measured 20 ms threshold), then `clear(Input)`.
2. **Short handshake timeout**: during the handshake the read timeout is 600 ms (TI's own driver
   uses 100 ms/500 ms for flash reads, docs/protocol.md:25); after a successful handshake the
   channel reverts to the library's 5 s so long sweeps are unaffected (first sweep frame can
   take >1 s). Implemented by a small channel wrapper with a shared `Arc<AtomicBool>`/atomic ms
   flag the driver flips (or any equivalent: do not leave 600 ms for sweeps).
3. **Bounded retry of open + calibration** in `Sa430Driver::open`: up to 4 attempts, each =
   backend open (fresh port, settle) + `calibration()`. Between attempts: drop the `Sa430`
   (releases the port), sleep a backoff (150, 300, 600 ms). The recovery ladder matches the
   observed healing (error -> unanswered frame -> close -> reopen), so attempt 3 normally
   succeeds even if the settle somehow isn't enough. Retry on: `Io` (timeout/would-block),
   `Device`/`UnexpectedResponse`/`InvalidData`/frame errors, `Serial` `PermissionDenied`/`NoDevice`
   during open (udev race). Do not retry: serial mismatch (that is a successful identification),
   `InvalidParameter`. Total budget: wall-clock deadline of 6 s from the first attempt; no new
   attempt starts if the next one could not finish (attempt worst case ~0.2+0.6+0.6 s).
   Worst case total ~ 4 x 1.4 s + 1.05 s backoff ~ 6.6 s; use a deadline check so it stays <= 6 s.
4. **Final failure** keeps the existing message ("{port} did not answer like an SA430 ({e}).
   Unplug and reconnect the analyzer, then try again.") with the *last* error as cause; open
   errors keep `open_error` hints. No success is reported unless `calibration()` succeeded.
5. `ConnectPolicy { attempts, settle (backend), backoff[], handshake_timeout, deadline }` with
   `Default` for production; `Sa430Driver::with_backend_and_policy` for tests (zero sleeps) so
   unit tests are instant and deterministic. Sleeping uses `std::thread::sleep` (driver `open` is
   already blocking and runs off the UI thread; core sets `Connecting` before calling it,
   session/mod.rs:374).

New dependency: `serialport` (direct, `version = "4.8"`, same major as the library's, already in
Cargo.lock as 4.10.1, so no new crate in the tree). Justification and the alternative in
ADR 0012.

## Modules / files touched

- `crates/spectrum-driver-sa430/Cargo.toml` (+serialport)
- `crates/spectrum-driver-sa430/src/lib.rs` (SerialBackend::open, policy, retry loop, tests)
- `crates/spectrum-driver-sa430/tests/session.rs` (session-level retry scenarios)
- `crates/spectrum-driver-sa430/tests/hardware.rs` (ignored hardware tests)
- `docs/sources.md` (SA430 section: settle + retry behaviour, known device quirk), `docs/adr/0012-...`
- No change: `spectrum-core`, `src-tauri`, UI, bindings (`npm run bindings` not needed; error text
  only changes if the final message changes, and it does not).

## Rejected alternatives

- Fix in the `sa430` crate (settle/timeout hook): upstream release needed; it's a third-party
  dep. Wrapping is enough. Can propose upstream later.
- Zero-flood / Sync-based in-band resync: shown unreliable on the device (above).
- Only a retry without settle: works only by the accidental "unanswered frame then reopen"
  effect and costs ~1.2 s on every first connect; the settle delay makes the first try succeed.
- Sleeping before every connect even when warm: 200 ms is imperceptible; not worth a "first
  open" detector.

## Risks

- Settle 200 ms was validated with 5-300 ms; reboot-based reproduction approximates but is not
  identical to a physical plug (USB power-up). QA must also verify a real replug with the human.
- Switching to our own serial settings must match the library (926100 baud is non-standard;
  serialport on Linux uses termios2 for that) — hardware test covers it.
- The timeout flip: if it fails to revert, sweeps could time out; session test + hardware sweep
  test cover it.
- Reboot-based hardware test is flaky about timing (half of my reboot attempts did not
  re-enumerate when issued right after a previous open); it must wait for node removal with a
  bounded wait and skip/fail clearly rather than hang.

## Test plan

Unit (driver crate, scripted `Sa430Backend`, zero-duration policy):
1. fails-then-succeeds: attempt 1 channel returns NoFrameStart error frame, attempt 2 full
   calibration -> `open` Ok, backend called twice, serial correct.
2. timeout-then-success: attempt 1 channel empty (MockChannel times out), attempt 2 ok.
3. NoFrameStart, timeout, success (the real sequence) -> ok on 3rd attempt.
4. persistent failure: every attempt fails -> Err kind Unavailable, message contains
   "did not answer like an SA430" and the "Unplug and reconnect" advice, backend called exactly
   `attempts` times, elapsed within budget (use a fake clock/`deadline` in policy, or assert
   attempt count and that backoffs sum < 6 s).
5. serial mismatch is not retried (backend called once); `PermissionDenied` open is retried then
   fails with the dialout hint; unreadable device: each retry gets a *fresh* `Sa430` (port
   dropped between attempts: assert via a drop counter in the scripted channel).
6. handshake timeout flag reverts after success (unit test on the wrapper channel with a fake
   port, or via the hardware test).
Session test (`tests/session.rs`): `connect()` through `SessionManager` where the first open is
glitchy: ends `Connected`; and persistent failure ends `Disconnected` with the actionable error
and state never `Connected`.
Hardware (`--ignored`, `SPECTRUM_E2E_SA430=1`): (a) 10 connect/disconnect cycles through
`Sa430Driver::open`, all first try, each < 1 s; (b) reboot-then-connect (re-enumeration
simulation, bounded waits): `open` succeeds on a default-policy driver and the attempt count is
reported (expect 1); (c) same with a zero-settle policy proves the retry ladder recovers on real
hardware (expect <= 3 attempts); (d) after connect a real sweep returns data (timeout reverted).
`npm run check` green. QA: >= 10 cycles via the app; human replug test.
