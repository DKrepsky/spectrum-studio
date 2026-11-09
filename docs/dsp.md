# Signal processing

All processing lives in `crates/spectrum-core/src/dsp/` (pure functions, numerically tested) and
is orchestrated by `session/pipeline.rs`.

## Pipeline

```
IQ source ─► latest N samples ─► window ─► FFT ─► |X|² / (Σw)² ─► dB ─► fftshift ─┐
                                                                                   ├─► power average ─► max/min hold ─► peak search ─► frame
trace source (already measured, in its own unit) ──────────────────────────────────┘
```

- One spectrum is computed per frame from the most recent `N` contiguous samples. Blocks shorter
  than `N` are accumulated; a discontinuity (retune, gap, loop) discards the partial buffer.
- Trace sources (spectrum analyzers) skip the FFT entirely — their data is never
  treated as IQ.
- Frames carry the exact settings that produced them (centre, span, bin spacing, RBW, FFT size,
  window, averaging state, unit). The UI labels the display from the frame, not from requested
  settings.

## Normalisation and units

The power in bin *k* is `P[k] = |X[k]|² / (Σ w[n])²`, so a complex sinusoid `A·e^{jωt}` centred on
a bin reads `20·log10(A)` **dBFS**, independent of FFT size and window. Full scale is a complex
magnitude of 1.0 (a sample with I = 1, Q = 0).

| Unit | Meaning | Calibrated? |
| --- | --- | --- |
| dBFS | Relative to converter full scale | No |
| dB | Relative, unknown reference | No |
| dBm | Absolute power (instrument- or user-calibrated) | Yes |

IQ-derived spectra are always dBFS: converting to dBm needs the receiver's gain chain and a
calibration, which no source provides yet. The status bar flags uncalibrated units.

### Noise

Broadband noise of total power `P` appears at `P − 10·log10(N) + 10·log10(ENBW)` per bin, so the
displayed noise floor drops 3 dB per doubling of the FFT size while tones stay put. The status bar
shows the estimated floor (median of the live trace) per bin.

| Window | ENBW (bins) | Worst-case scalloping | Use |
| --- | --- | --- | --- |
| Rectangular | 1.00 | 3.92 dB | Maximum resolution; strong leakage |
| Hann | 1.50 | 1.42 dB | Default, good compromise |
| Blackman-Harris (4-term) | 2.00 | 0.83 dB | Low leakage, weak signals near strong ones |
| Flat top | 3.77 | < 0.01 dB | Amplitude accuracy |

RBW is reported as `ENBW × fs / N`.

## Averaging and holds

- Averaging is done on **linear power** (a dB-domain average would bias noise low by ≈ 2.5 dB).
  The first `n` traces use a cumulative mean (fast settling), then an exponential moving average
  with α = 1/n.
- Max/min hold track the averaged trace. Both averages and holds restart whenever the frequency
  axis, bin count, window or unit changes, so values from different settings are never mixed.

## Peak search

1. **Noise floor** = median of the live trace (robust while signals occupy < 50 % of the bins).
2. **Candidates** = local maxima (plateaus report their centre).
3. **Criteria:** at least *Above noise* dB above the floor (default 15), optional absolute
   threshold, and a topographic **prominence** ≥ 6 dB (height above the higher of the two lowest
   points separating the peak from higher signal), which rejects ripples on a larger peak.
4. **Interpolation** using the window's known shape:
   - Rectangular: exact magnitude-ratio estimator `δ = r/(1+r)`;
   - Hann: exact Grandke estimator `δ = (2r − 1)/(r + 1)`;
   - Blackman-Harris, flat top: parabola through the three dB values;
   - the amplitude is the bin level plus the window's exact scalloping loss at offset δ
     (precomputed from the window's DTFT).
   Trace sources use parabolic interpolation (their filter shape is unknown).

Measured accuracy for an isolated tone (unit tests, −100 dBFS noise):

| Window | Frequency error | Amplitude error |
| --- | --- | --- |
| Hann, Rectangular | < 0.02 bin | < 0.05 dB |
| Blackman-Harris | < 0.05 bin | < 0.1 dB |
| Flat top | < 0.2 bin (flat main lobe) | < 0.05 dB |

Markers read the trace itself (linear interpolation between bins), like instrument markers; use
the peak table or Peak search for interpolated peak values.

## Display resampling

When bins outnumber pixels, each column shows the maximum of the bins it covers (peak detector),
so narrow signals keep their height. When zoomed in, every bin becomes a vertex. The waterfall uses
the same peak-preserving mapping.
