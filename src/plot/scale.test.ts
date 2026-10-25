import { linearScale, niceStep, ticks } from './scale';

describe('linearScale', () => {
  it('maps and inverts, including inverted ranges', () => {
    const s = linearScale(0, 100, 200, 0);
    expect(s.map(0)).toBe(200);
    expect(s.map(25)).toBe(150);
    expect(s.invert(150)).toBe(25);
  });
});

describe('ticks', () => {
  it('uses 1/2/5 steps', () => {
    expect(niceStep(10, 10)).toBe(1);
    expect(niceStep(2_048_000, 10)).toBe(500_000);
    expect(niceStep(120, 12)).toBe(10);
    expect(niceStep(0.3, 5)).toBeCloseTo(0.1);
  });

  it('produces clean tick values inside the range', () => {
    const { values, step } = ticks(98_976_000, 101_024_000, 8);
    expect(step).toBe(500_000);
    expect(values).toEqual([99e6, 99.5e6, 100e6, 100.5e6, 101e6]);
    expect(ticks(-120, 0, 12).values).toHaveLength(13);
    expect(ticks(0.1, 0.7, 6).values).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
  });
});
