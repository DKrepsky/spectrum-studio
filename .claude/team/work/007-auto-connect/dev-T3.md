# 007 T3 developer record (shell wiring and real-device check)

Date: 2026-11-16. Build: dev (`npm run tauri dev`), isolated `XDG_CONFIG_HOME` under the scratchpad,
`RUST_LOG=spectrum_core=debug,spectrum_driver_sa430=debug`. Device: TI SA430 on `/dev/ttyACM0`.

## Checks on the real SA430

| # | Step | Result |
| --- | --- | --- |
| 1 | Launch with device attached, empty config | Pass. Log: `source connected` then `auto-connected` (07:55:00.86). Screenshot: source button shows SA430 08FF41E50F8B3A34, status Stopped, no notice. |
| 2 | Window close with device connected | Pass. Log: `source disconnected`, process exits. |
| 3 | `Sa430::reboot()` x3 (hardware test `reboot_then_connect_succeeds_with_the_default_policy`, app closed) | Pass 3/3. Port gone ~5 ms, back after 655-661 ms, connected on attempt 2 (380 ms). |
| 4 | Relaunch after the reboot cycles, remembered entry | Pass. Log: `auto-connected`; toolbar screenshot shows SA430 connected, Play available (paused). |
| 5 | Unplug while paused / acquiring, replug | Not run: needs a physical unplug. The app holds the port exclusively, so the reboot helper cannot run alongside it (EBUSY). Covered by core and driver tests. |
| 6 | Simulator connected, then plug-in | Not run: needs UI selection of the simulator. Covered by core test (Added while simulator connected changes nothing). |
| 7 | Manual disconnect with device attached | Not run: needs a UI click (no reliable input tool here). Covered by core test. |

## Launch status race

The webview calls `onStatus` (subscribe) before `get_status`, and `receiveStatus` drops statuses with
an older revision. A connect that finished before the webview loaded is therefore fetched by
`get_status`, and the screenshot confirms it shows. No change made and no test added.

## Not done

- Optional e2e spec for launch with no hardware: not written (no e2e run this session).
- Steps 5 to 7 above: human QA, procedure in `docs/testing.md` (*Auto-connect on real hardware*).
