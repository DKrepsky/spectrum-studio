const UNITS = [
  { scale: 1e9, unit: 'GHz' },
  { scale: 1e6, unit: 'MHz' },
  { scale: 1e3, unit: 'kHz' },
  { scale: 1, unit: 'Hz' },
] as const;

function unitFor(hz: number): (typeof UNITS)[number] {
  const abs = Math.abs(hz);
  return UNITS.find((u) => abs >= u.scale) ?? UNITS[UNITS.length - 1]!;
}

/**
 * Formats a frequency with an SI prefix. `resolutionHz` controls how many decimals are shown so
 * that a change of one resolution step is visible (e.g. 100.2505 MHz at 500 Hz resolution).
 */
export function formatFrequency(hz: number, resolutionHz = 1, unitHz?: number): string {
  if (!Number.isFinite(hz)) return '—';
  const u = unitHz === undefined ? unitFor(hz) : unitFor(unitHz);
  const decimals = Math.max(
    0,
    Math.min(9, Math.ceil(Math.log10(u.scale / Math.max(resolutionHz, 1e-9)))),
  );
  return `${(hz / u.scale).toFixed(decimals)} ${u.unit}`;
}

/** Compact format for axis labels and spans: trims trailing zeros. */
export function formatFrequencyShort(hz: number): string {
  if (!Number.isFinite(hz)) return '—';
  const u = unitFor(hz);
  const value = Number((hz / u.scale).toPrecision(10));
  return `${value} ${u.unit}`;
}

const SUFFIX: Record<string, number> = {
  '': 1,
  hz: 1,
  k: 1e3,
  khz: 1e3,
  m: 1e6,
  mhz: 1e6,
  g: 1e9,
  ghz: 1e9,
};

/**
 * Parses user input such as `100.2M`, `433.92 MHz`, `2.4g`, `12 kHz` or `100200000`.
 * Returns `null` if the text is not a valid frequency.
 */
export function parseFrequency(text: string): number | null {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(text);
  if (!match) return null;
  const multiplier = SUFFIX[(match[2] ?? '').toLowerCase()];
  if (multiplier === undefined) return null;
  const value = Number(match[1]) * multiplier;
  return Number.isFinite(value) ? value : null;
}

export function formatLevel(value: number, unit: string, decimals = 1): string {
  return Number.isFinite(value) ? `${value.toFixed(decimals)} ${unit}` : '—';
}
