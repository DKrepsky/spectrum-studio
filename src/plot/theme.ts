/**
 * Canvas theme (ADR 0015 section 4, DESIGN.md Appendix B). Colours are read at runtime from the
 * token file, so the canvas never holds a copy of a colour. Data palettes (`colormap.ts`) and the
 * plot geometry (`PLOT_INSETS`) stay in TypeScript.
 */

/** Reads a custom property by name; returns '' when it is not defined. */
export type TokenReader = (name: string) => string;

/** Canvas key to the token it reads (Appendix B). Font keys are built from two tokens. */
export const PLOT_COLOUR_TOKENS = {
  background: '--color-surface-app',
  plotBackground: '--color-surface-plot',
  grid: '--color-grid',
  gridStrong: '--color-grid-strong',
  axisText: '--color-text-axis',
  liveTrace: '--color-trace-live',
  liveFill: '--color-trace-live-fill',
  staleTrace: '--color-trace-stale',
  maxHold: '--color-trace-max-hold',
  minHold: '--color-trace-min-hold',
  peak: '--color-peak',
  marker: '--color-marker',
  markerActive: '--color-marker-active',
  crosshair: '--color-crosshair',
  readoutBackground: '--color-scrim-readout',
  readoutText: '--color-text-readout',
} as const;

export interface PlotTheme {
  background: string;
  plotBackground: string;
  grid: string;
  gridStrong: string;
  axisText: string;
  liveTrace: string;
  liveFill: string;
  staleTrace: string;
  maxHold: string;
  minHold: string;
  peak: string;
  marker: string;
  markerActive: string;
  crosshair: string;
  readoutBackground: string;
  readoutText: string;
  font: string;
  monoFont: string;
}

/** Plot area insets in CSS pixels; the waterfall uses the same horizontal insets to align. */
export const PLOT_INSETS = { left: 64, right: 14, top: 10, bottom: 26 } as const;

const defaultRead: TokenReader = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function required(read: TokenReader, name: string): string {
  const value = read(name);
  if (!value) throw new Error(`missing token ${name}`);
  return value;
}

function buildTheme(read: TokenReader): PlotTheme {
  const colours = {} as Record<keyof typeof PLOT_COLOUR_TOKENS, string>;
  for (const key of Object.keys(PLOT_COLOUR_TOKENS) as (keyof typeof PLOT_COLOUR_TOKENS)[]) {
    colours[key] = required(read, PLOT_COLOUR_TOKENS[key]);
  }
  const size = required(read, '--font-size-xs');
  return {
    ...colours,
    font: `${size} ${required(read, '--font-family-ui')}`,
    monoFont: `${size} ${required(read, '--font-family-mono')}`,
  };
}

let cached: PlotTheme | null = null;

/**
 * The plot theme, built on first call and cached. Call it at draw time, not at module load, so
 * the stylesheet is loaded. `read` is injectable for tests; only the first call's reader is used,
 * so tests call `resetPlotTheme()` first. A missing token throws; there is no fallback.
 */
export function getPlotTheme(read: TokenReader = defaultRead): PlotTheme {
  cached ??= buildTheme(read);
  return cached;
}

/** Forgets the cached theme (tests only). */
export function resetPlotTheme(): void {
  cached = null;
}
