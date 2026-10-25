# Status and roadmap

Status as of 2026-10-25 (version 0.1.0). "Done" means implemented, tested and verified in the
running application.

## Initial delivery

| # | Capability | Status | Verified by |
| --- | --- | --- | --- |
| 1 | Launch on Linux | Done | E2E (all specs), manual |
| 2 | Select and connect the built-in simulator | Done | E2E `acquisition`, session tests |
| 3 | Continuously updating spectrum from simulated IQ | Done | E2E, pipeline/estimator tests |
| 4 | Change frequency and processing settings | Done | E2E (centre, FFT, window), session tests |
| 5 | Peaks and basic analysis tools (markers, peak table, holds, averaging) | Done | E2E, DSP tests |
| 6 | Waterfall of changing signals | Done | Manual/screenshot, time-scale unit test |
| 7 | Start, stop, disconnect | Done | E2E, session tests |
| 8 | Manage and save source configurations | Done | E2E `persistence`, store tests |
| 9 | Export spectrum data to CSV | Done | CSV tests, export → import session test, manual dialog check |
| 10 | Preferences retained after restart | Done | E2E `persistence`, store tests |
| — | IQ recordings (SigMF, raw) and CSV traces | Done | E2E `files`, format and session tests |
| — | Failure handling (connect failure, device loss, end of stream, invalid files) | Done | E2E `failures`/`files`, session tests |
| — | `.deb` and AppImage packages | Done | `npm run tauri build` |

## Known limitations

- No real hardware integrations yet; SoapySDR, rtl_tcp, SCPI-over-LAN and tinySA are listed as
  planned.
- No amplitude calibration: IQ spectra are dBFS only.
- One spectrum per frame from the newest samples (no overlapped Welch averaging within a block);
  the frame rate is capped at 30 fps by the simulator and file playback.
- Peak detection reports every distinct local maximum, so modulated signals can contribute several
  peaks (e.g. FM sidebands); there is no minimum-separation setting yet.
- Plot colours use a fixed dark theme.
- Export uses the native dialog, which is not covered by automated E2E tests.

## Next steps (suggested order)

1. **First hardware integration** once a device is chosen — likely SoapySDR (covers RTL-SDR,
   HackRF, Airspy) via the `soapysdr` crate, or rtl_tcp (pure network protocol, no native deps).
2. Gain/AGC and PPM correction as SDR `ParamSpec`s; DC-spike handling.
3. Optional calibration profile (offset table) to turn dBFS into dBm, with clear labelling.
4. SCPI analyzer driver (trace sources, dBm) using a mock TCP server in tests.
5. Channel power / occupied bandwidth measurements; marker noise density (dBm/Hz).
6. IQ recording from live sources (SigMF writer).
7. Minimum peak separation, peak tracking across frames.
8. Light theme and keyboard shortcuts.
