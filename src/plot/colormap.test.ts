import { buildLut, levelIndex } from './colormap';

describe('colormap', () => {
  it('builds opaque LUTs with the expected end points', () => {
    const lut = buildLut('grayscale');
    expect(lut).toHaveLength(256);
    expect(lut[0]! >>> 0).toBe(0xff000000);
    expect(lut[255]! >>> 0).toBe(0xffffffff);
    for (const palette of ['classic', 'viridis'] as const) {
      expect(buildLut(palette).every((c) => c >>> 24 === 0xff)).toBe(true);
    }
  });

  it('maps levels into the displayed range', () => {
    expect(levelIndex(0, 0, 100)).toBe(255);
    expect(levelIndex(-100, 0, 100)).toBe(0);
    expect(levelIndex(-50, 0, 100)).toBe(128);
    expect(levelIndex(20, 0, 100)).toBe(255);
    expect(levelIndex(Number.NaN, 0, 100)).toBe(0);
  });
});
