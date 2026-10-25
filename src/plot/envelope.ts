import type { FrameHeader } from '../bindings/FrameHeader';

/**
 * Resamples a trace onto `width` pixel columns covering [startHz, endHz).
 *
 * Each column takes the maximum of every bin whose extent (centre ± half a bin) overlaps the
 * column (a peak detector), so narrow signals keep their true height at any zoom level.
 * Columns outside the trace are `NaN`.
 */
export function columnEnvelope(
  trace: Float32Array,
  header: Pick<FrameHeader, 'startHz' | 'binHz'>,
  startHz: number,
  endHz: number,
  width: number,
  out: Float32Array = new Float32Array(width),
): Float32Array {
  const n = trace.length;
  const columnBins = (endHz - startHz) / width / header.binHz;
  const first = (startHz - header.startHz) / header.binHz;
  for (let x = 0; x < width; x++) {
    // Column edges in bin units; bin b covers [b - 0.5, b + 0.5).
    const p0 = first + x * columnBins;
    const p1 = p0 + columnBins;
    const b0 = Math.max(0, Math.round(p0));
    const b1 = Math.min(n - 1, Math.round(p1) - (Math.round(p1) - 0.5 === p1 ? 1 : 0));
    if (b0 > b1 || p1 <= -0.5 || p0 >= n - 0.5) {
      out[x] = Number.NaN;
      continue;
    }
    let max = trace[b0]!;
    for (let b = b0 + 1; b <= b1; b++) {
      const v = trace[b]!;
      if (v > max) max = v;
    }
    out[x] = max;
  }
  return out;
}

/**
 * Points to draw a trace as a line: one vertex per bin when bins are at least `minBinPx` wide
 * (zoomed in, exact shape), otherwise one vertex per column from {@link columnEnvelope}.
 * `x` values are pixel offsets from the left edge of the plot.
 */
export function tracePoints(
  trace: Float32Array,
  header: Pick<FrameHeader, 'startHz' | 'binHz'>,
  startHz: number,
  endHz: number,
  width: number,
  minBinPx = 2,
): { x: Float32Array; y: Float32Array } {
  const pxPerHz = width / (endHz - startHz);
  if (header.binHz * pxPerHz < minBinPx) {
    const y = columnEnvelope(trace, header, startHz, endHz, width);
    return { x: Float32Array.from({ length: width }, (_, i) => i + 0.5), y };
  }
  // Include one bin beyond each edge so the line reaches the plot border.
  const b0 = Math.max(0, Math.floor((startHz - header.startHz) / header.binHz));
  const b1 = Math.min(trace.length - 1, Math.ceil((endHz - header.startHz) / header.binHz));
  const count = Math.max(0, b1 - b0 + 1);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    x[i] = (header.startHz + (b0 + i) * header.binHz - startHz) * pxPerHz;
    y[i] = trace[b0 + i]!;
  }
  return { x, y };
}

function interpolate(trace: Float32Array, position: number): number {
  const n = trace.length;
  if (position <= 0) return trace[0]!;
  if (position >= n - 1) return trace[n - 1]!;
  const i = Math.floor(position);
  const t = position - i;
  return trace[i]! * (1 - t) + trace[i + 1]! * t;
}

/** Value of the trace at a frequency, linearly interpolated between bins; NaN outside. */
export function valueAt(
  trace: Float32Array,
  header: Pick<FrameHeader, 'startHz' | 'binHz'>,
  hz: number,
): number {
  const position = (hz - header.startHz) / header.binHz;
  if (position < -0.5 || position > trace.length - 0.5) return Number.NaN;
  return interpolate(trace, position);
}
