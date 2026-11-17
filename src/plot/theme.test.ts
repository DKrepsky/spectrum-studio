import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseTokens, resolveToken, toRgba, type Tokens } from '../test/tokens';
import {
  getPlotTheme,
  PLOT_COLOUR_TOKENS,
  resetPlotTheme,
  type PlotTheme,
  type TokenReader,
} from './theme';
import { drawSpectrum, type SpectrumDrawOptions } from './spectrumRenderer';

const tokens: Tokens = parseTokens(readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8'));
const resolver: TokenReader = (name) => {
  try {
    return resolveToken(name, tokens);
  } catch {
    return '';
  }
};

/** The values the canvas used before it read tokens (the regression baseline: no visual change). */
const TODAY: Record<Exclude<keyof PlotTheme, 'font' | 'monoFont'>, string> = {
  background: '#0b1018',
  plotBackground: '#0e1520',
  grid: 'rgba(120, 150, 190, 0.14)',
  gridStrong: 'rgba(120, 150, 190, 0.28)',
  axisText: '#8ea0b8',
  liveTrace: '#3ee0b5',
  liveFill: 'rgba(62, 224, 181, 0.10)',
  staleTrace: '#7a8799',
  maxHold: '#ff9f43',
  minHold: '#5aa9ff',
  peak: '#ffd166',
  marker: '#ff6bcb',
  markerActive: '#ffffff',
  crosshair: 'rgba(220, 230, 245, 0.45)',
  readoutBackground: 'rgba(8, 12, 18, 0.88)',
  readoutText: '#e6edf6',
};

/** Colours compare as numbers (`0.1` and `0.10` are the same colour). */
function sameColour(actual: string, expected: string): boolean {
  return JSON.stringify(toRgba(actual)) === JSON.stringify(toRgba(expected));
}

describe('getPlotTheme', () => {
  beforeEach(() => resetPlotTheme());

  it('resolves every colour key to the value the canvas used before the tokens', () => {
    const theme = getPlotTheme(resolver);
    for (const key of Object.keys(TODAY) as (keyof typeof TODAY)[]) {
      expect(sameColour(theme[key], TODAY[key]), key).toBe(true);
    }
  });

  it('builds the fonts from the size and family tokens, as the canvas had them', () => {
    const theme = getPlotTheme(resolver);
    // Single quotes are the token file's spelling; canvas parses both identically.
    const normalise = (font: string) => font.replaceAll("'", '"');
    expect(normalise(theme.font)).toBe(
      '11px "Inter", "Cantarell", "Ubuntu", system-ui, sans-serif',
    );
    expect(normalise(theme.monoFont)).toBe(
      '11px "JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace',
    );
  });

  it('maps every key to a token that tokens.css defines', () => {
    for (const [key, token] of Object.entries(PLOT_COLOUR_TOKENS)) {
      expect(tokens.has(token), `${key} -> ${token}`).toBe(true);
    }
    expect(tokens.has('--font-size-xs')).toBe(true);
    expect(tokens.has('--font-family-ui')).toBe(true);
    expect(tokens.has('--font-family-mono')).toBe(true);
  });

  it('throws naming the token when one is missing or empty', () => {
    const withoutGrid: TokenReader = (name) => (name === '--color-grid' ? '' : resolver(name));
    expect(() => getPlotTheme(withoutGrid)).toThrow('missing token --color-grid');
    resetPlotTheme();
    const noFont: TokenReader = (name) => (name === '--font-family-mono' ? '' : resolver(name));
    expect(() => getPlotTheme(noFont)).toThrow('missing token --font-family-mono');
  });

  it('caches the first theme until reset', () => {
    const first = getPlotTheme(resolver);
    expect(getPlotTheme(() => '#123456')).toBe(first);
    resetPlotTheme();
    expect(getPlotTheme(() => '#123456').background).toBe('#123456');
  });
});

describe('drawSpectrum', () => {
  beforeEach(() => resetPlotTheme());

  it('paints the background and plot area with the token colours', () => {
    getPlotTheme(resolver);
    const painted: string[] = [];
    const state: Record<string, unknown> = {};
    const ctx = new Proxy(state, {
      get(target, prop) {
        if (prop === 'fillRect') return () => painted.push(String(target.fillStyle));
        if (prop === 'measureText') return () => ({ width: 10 });
        return prop in target ? target[prop as string] : () => undefined;
      },
      set(target, prop, value) {
        target[prop as string] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;

    const options: SpectrumDrawOptions = {
      width: 400,
      height: 200,
      frame: null,
      view: { startHz: 0, endHz: 1_000_000 },
      referenceLevel: 0,
      rangeDb: 100,
      unit: 'dBFS',
      live: true,
      markers: [],
      activeMarker: null,
      selectedPeakHz: null,
      hover: null,
    };
    drawSpectrum(ctx, options);
    expect(painted.slice(0, 2)).toEqual([
      resolveToken('--color-surface-app', tokens),
      resolveToken('--color-surface-plot', tokens),
    ]);
  });
});
