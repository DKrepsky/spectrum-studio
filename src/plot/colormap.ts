import type { Palette } from '../state/view';

type Stop = readonly [position: number, r: number, g: number, b: number];

const STOPS: Record<Palette, readonly Stop[]> = {
  // Black → blue → cyan → yellow → red → white, common in SDR software.
  classic: [
    [0, 0, 0, 0],
    [0.2, 0, 0, 140],
    [0.4, 0, 170, 220],
    [0.6, 240, 230, 40],
    [0.8, 230, 40, 20],
    [1, 255, 255, 255],
  ],
  // Approximation of matplotlib's perceptually uniform viridis.
  viridis: [
    [0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1, 253, 231, 37],
  ],
  grayscale: [
    [0, 0, 0, 0],
    [1, 255, 255, 255],
  ],
};

/** 256-entry RGBA lookup table packed as little-endian `0xAABBGGRR` for ImageData views. */
export function buildLut(palette: Palette): Uint32Array {
  const stops = STOPS[palette];
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1]![0]) k++;
    const [p0, r0, g0, b0] = stops[k]!;
    const [p1, r1, g1, b1] = stops[k + 1]!;
    const u = (t - p0) / (p1 - p0);
    const r = Math.round(r0 + (r1 - r0) * u);
    const g = Math.round(g0 + (g1 - g0) * u);
    const b = Math.round(b0 + (b1 - b0) * u);
    lut[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
}

/** Maps a level to a LUT index for the displayed range [ref - range, ref]. */
export function levelIndex(value: number, reference: number, rangeDb: number): number {
  if (Number.isNaN(value)) return 0;
  const t = (value - (reference - rangeDb)) / rangeDb;
  return Math.max(0, Math.min(255, Math.round(t * 255)));
}
