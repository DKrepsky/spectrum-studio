/** Linear mapping between a data domain and a pixel range. */
export interface LinearScale {
  readonly d0: number;
  readonly d1: number;
  readonly r0: number;
  readonly r1: number;
  map: (value: number) => number;
  invert: (pixel: number) => number;
}

export function linearScale(d0: number, d1: number, r0: number, r1: number): LinearScale {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return {
    d0,
    d1,
    r0,
    r1,
    map: (v) => r0 + (v - d0) * k,
    invert: (p) => d0 + (p - r0) / k,
  };
}

/** A "nice" step (1, 2 or 5 × 10^n) giving at most `maxTicks` intervals over `span`. */
export function niceStep(span: number, maxTicks: number): number {
  if (!(span > 0) || maxTicks < 1) return 1;
  const raw = span / maxTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** Tick values that are multiples of a nice step within [min, max]. */
export function ticks(
  min: number,
  max: number,
  maxTicks: number,
): { values: number[]; step: number } {
  const step = niceStep(max - min, maxTicks);
  const values: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + step * 1e-9; v += step) {
    // Avoid accumulating floating point error in labels.
    values.push(Number((Math.round(v / step) * step).toPrecision(12)));
  }
  return { values, step };
}
