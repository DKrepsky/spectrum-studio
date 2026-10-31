# File formats

## IQ recordings (input)

Code: `crates/spectrum-core/src/formats/iq.rs`.

| Format | SigMF datatype | Extensions | Sample size | Scaling to ±1.0 full scale |
| --- | --- | --- | --- | --- |
| cf32 | `cf32_le` | `.cf32`, `.cfile`, `.fc32` | 8 bytes | as stored |
| cs16 | `ci16_le` | `.cs16`, `.sc16` | 4 bytes | ÷ 32768 |
| cu8 | `cu8` | `.cu8` (rtl_sdr) | 2 bytes | (x − 127.5) ÷ 127.5 |
| cs8 | `ci8` | `.cs8`, `.sc8` (HackRF) | 2 bytes | ÷ 128 |

All formats are interleaved I, Q, little-endian.

**SigMF** — select either the `.sigmf-meta` or `.sigmf-data` file; both must be side by side. Used
fields: `global.core:datatype`, `global.core:sample_rate`, first capture's `core:frequency`
(0 if absent) and `core:sample_start`. Unsupported: big-endian and real-valued datatypes, other
complex types (cf64, ci32…), multiple captures (only the first is used), multi-channel data.

**Raw files** carry no metadata: choose the format (or rely on the extension) and enter the sample
rate; the centre frequency is optional. Trailing partial samples are ignored.

Validation errors name the problem, e.g. *"SigMF datatype "rf32_le" is not supported"*, *"Raw IQ
files carry no metadata: enter the recording's sample rate."*, *"The recording has only 4000
samples; choose an FFT size of at most 4000."*

## Spectrum CSV (export and import)

Code: `crates/spectrum-core/src/formats/csv.rs`.

### Export layout

```text
# Spectrum Studio spectrum export
# format_version,1
# exported_at,2026-10-25T17:49:23.266Z
# measured_at,2026-10-25T17:48:58.459Z
# source,Signal simulator
# simulated,true
# data_kind,iq
# unit,dBFS
# calibrated,false
# center_hz,100000000.000
# span_hz,2048000.000
# bin_spacing_hz,500.000000
# points,4096
# rbw_hz,750.000000
# fft_size,4096
# window,hann
# averaging,1 of 1
# noise_floor,-85.961
frequency_hz,live_dBFS,max_hold_dBFS
98976000.000,-81.809,-75.210
...
```

- Metadata lines start with `#` (e.g. `pandas.read_csv(path, comment="#")`).
- Columns: `frequency_hz` plus one column per trace present (`live`, `max_hold`, `min_hold`),
  suffixed with the unit. Frequencies in Hz with 3 decimals, levels with 3 decimals (0.001 dB).
- `rbw_hz`, `fft_size`, `window`, `noise_floor` appear only when known.
- The exported frame is the one on screen when *Export* was pressed.

### Import

Accepted: Spectrum Studio exports, or any CSV/TSV/semicolon file whose first two columns are
frequency (Hz) and level, with an optional header row. Rules:

- at least two data rows, at most 1 000 000;
- frequencies strictly increasing and evenly spaced (tolerance 0.1 % of the spacing);
- unit from `# unit,...` metadata or the level column header (`live_dBm`, `Level (dBm)`); if
  absent the trace is labelled relative `dB` unless the user chooses a unit when connecting.

## Persisted settings

`~/.config/io.github.spectrumstudio/` (respects `XDG_CONFIG_HOME`):

| File | Contents |
| --- | --- |
| `preferences.json` | `version`, `processing` (FFT, window, averaging, holds, peak settings), `display` (reference level, range, waterfall, palette), `lastSourceId` (the selected remembered source; v1 files had `lastSource`, migrated on load) |
| `sources.json` | `version` (3), `sources[]` with `id`, `name` (user override, may be empty), `label` (automatic name captured at connect), `config` (`driverId`, `deviceId` = the device's stable identity such as the SA430 serial, `connection` = where it was last found, last effective `settings`), `createdMs`, `updatedMs`, `lastUsedMs`. Written when a source is connected, added, edited or forgotten |

### `sources.json` upgrades

An older file (version 1 or 2) is upgraded **when it is loaded**, not on the next change:

1. each entry's driver normalizes its `deviceId` (SA430: the serial instead of a port name or none);
2. records of the same device are merged into one (a record with the user's name wins, the oldest
   `createdMs`, the newest settings and `lastUsedMs`; a different name that has to be dropped is
   reported in a warning and stays in the backup); non-device entries merge only when driver, connection
   and displayed name are all equal, so distinct named presets are never merged;
3. the previous file is copied, untouched, to `sources.pre-v3-<epoch ms>.json` in the same
   directory (a new name each time, nothing is overwritten);
4. the result is written atomically as version 3. If the backup or the write fails, the upgraded
   list is used in memory, a warning is shown and the upgrade is retried with the next change.

Entries of unknown or planned drivers are kept as they were. Known limits: unknown JSON fields are
not preserved, and a file with a *newer* version than this build is not protected from being
overwritten on the next change (see [roadmap.md](roadmap.md)).

Files are written atomically and validated on load. Missing fields take defaults (forward
compatible); invalid files are renamed to `*.corrupt-<timestamp>.json` and replaced by defaults.
