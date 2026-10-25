# User guide

## First run

1. Start Spectrum Studio. The **Source** selector in the toolbar defaults to *Signal simulator*.
2. Press **▶ Run**. The application connects to the selected source and starts acquiring.
3. The state pill shows **Acquiring**, the plot shows **LIVE**, and a purple **SIMULATED** badge
   reminds you the data is generated.

## Toolbar

| Control | Purpose |
| --- | --- |
| Source | Picks the source that Connect/Run use: saved configurations or ready-to-use source types. Entries ending in “…” need more details and open the Sources dialog. |
| Sources… | Opens the source manager (discovery, connection settings, saved configurations, files). |
| Connect / Disconnect | Opens or releases the source without acquiring. |
| Switch | Appears when the selection differs from the connected source; stops and releases the current source, then connects the new one. |
| ▶ Run / ■ Stop | Starts or stops acquisition (Run connects first if needed). |
| State pill | Authoritative backend state: Disconnected, Connecting…, Connected, Acquiring, Disconnecting…. |
| Center / Span | Tuning and span, enabled only when the source supports them. Center accepts `100.2M`, `433.92 MHz`, `2.4G`, `12k`; ↑/↓ step by a tenth of the span. Invalid input stays highlighted until corrected or Escape. |
| Export CSV | Saves the displayed spectrum (see [file-formats.md](file-formats.md)). |

## Reading the display

- **Spectrum:** frequency on the horizontal axis, level on the vertical axis in the unit printed
  on the axis and in the status bar. Live trace in green, max hold orange, min hold blue.
- **Liveness badge** (top right): `LIVE` while frames arrive; `Waiting for data…`; `No data for
  N s` if acquisition stalls; `HOLD · last data hh:mm:ss` when stopped — the trace turns grey so
  retained data is never mistaken for a current measurement.
- **Waterfall:** one row per frame, newest at the top, colour-mapped with the same reference level
  and range as the spectrum. The left scale shows the age of rows. It is cleared when the view or
  colour scale changes, so rows always match the axis above.
- **Status bar:** the settings that produced the frame on screen — centre, span, RBW (equivalent
  noise bandwidth of one bin), FFT size and window, averaging progress, estimated noise floor per
  bin, unit, frame rate and timestamp. **Uncalibrated** is shown for dBFS/dB data.

### Mouse

| Action | Effect |
| --- | --- |
| Wheel over the plot | Zoom frequency around the cursor |
| Drag | Pan |
| Double-click | Back to the full span |
| Wheel over the level axis | Move the reference level |
| Ctrl + wheel | Change the displayed range |
| Click | Move the active marker (or create one) |
| Shift + click | Add a marker |
| Hover | Crosshair with frequency, cursor level and trace level |

Display zoom only changes what is shown. To change what is measured, use Center and Span.

## Measurement panel

- **FFT size:** more points → finer resolution (RBW = ENBW × sample rate / N) and a lower noise
  floor per bin, at the cost of slower updates for low sample rates.
- **Window:** Hann (default, good general purpose), Rectangular (best resolution, high leakage),
  Blackman-Harris (low leakage), Flat top (most accurate amplitudes). See [dsp.md](dsp.md).
- **Averaging:** number of traces averaged in the power domain (1 = off).
- **Max/Min hold** and **Reset**. Holds and averages restart automatically when the frequency
  axis changes.

FFT size and window are disabled for sources that supply measured traces.

## Markers and peaks

- **Peak search** puts the active marker on the strongest peak; **Next peak** walks down the list.
- Marker rows show frequency and the trace level there; markers 2–4 also show Δ to marker 1.
- **⇥** sets the centre frequency to the marker (tunable sources only).
- The **Peaks** table lists detected peaks with interpolated frequency, level and prominence.
  Click a row to highlight it and move the active marker to it. *Above noise* sets how far a
  peak must rise above the estimated noise floor.

## Sources dialog

- **Saved configurations:** connect, rename or delete saved setups.
- **Simulation / Files / SDRs / Spectrum analyzers:** source types grouped by kind, with their
  transport (Built-in, File, USB, Serial, Network). Types marked **Planned** are not implemented
  yet and cannot be connected.
- **Devices:** discovered devices for types that support discovery (Scan to refresh).
- **Connection:** settings needed to open the source, generated from the driver's description.
- **Save setup…** (header): saves the connected source including its current centre, span and
  settings. **Save configuration…** saves the connection settings of a source type.
- **Open file…** (Files heading): pick a recording; the matching file type is selected.

## Simulator

Open *Source settings* in the side panel while connected. Every emitter has an absolute RF
frequency, so retuning moves signals across the display like a real receiver:

| Group | Default |
| --- | --- |
| Noise | −50 dBFS total complex white noise |
| Tone 1 / 2 / 3 | 100.25 MHz −20 dBFS, 99.6 MHz −42 dBFS, (off) 100.7 MHz −60 dBFS |
| Drifting carrier | 99.85 MHz ± 40 kHz, 8 s period, −48 dBFS |
| Bursts | 100.45 MHz, 1.5 s period, 30 % duty, −35 dBFS |
| FM carrier | 99.35 MHz, 4 kHz deviation, 1 kHz rate, −38 dBFS |
| Sweep | (off) chirp across 90 % of the span every 6 s, −45 dBFS |
| Testing | seed 1; *Simulate device loss after* N s; *Fail to connect* (connection option) |

The same seed and settings always produce the same samples.

## Recordings

- **IQ recording:** SigMF (`.sigmf-meta`/`.sigmf-data`) or raw `cf32`/`cs16`/`cu8`/`cs8`. Raw
  files need the sample rate (and optionally the centre frequency). Playback is paced to real
  time; *Loop playback* and *Playback speed* are in Source settings.
- **Spectrum trace (CSV):** shown as supplied in its own unit; no FFT is applied. A single trace
  ends the "recording", so the display shows HOLD afterwards.

## When things go wrong

- A failed connection shows a red notice with the reason; the state stays *Disconnected*.
- If a device disappears during acquisition, the source is closed, the notice says why, and
  **Reconnect** reopens the same configuration.
- Recoverable read errors stop acquisition and offer **Restart**.
- Invalid settings are rejected with an explanation; the previous settings stay in effect.
- Corrupt preference files are backed up (`*.corrupt-<time>.json`) and reset, with a notice.

## Where data is stored

`~/.config/io.github.spectrumstudio/preferences.json` (processing and display settings, last
selected source) and `sources.json` (saved configurations). Nothing is sent anywhere.
