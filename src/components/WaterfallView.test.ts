import { timeTicks } from './WaterfallView';

describe('timeTicks', () => {
  it('labels rows by age relative to the newest row', () => {
    // 30 rows per second, one row per device pixel at dpr 1.
    const rows = Array.from({ length: 200 }, (_, i) => 10_000 - (i * 1000) / 30);
    const ticks = timeTicks(rows, 200, 1);
    expect(ticks.map((t) => t.y)).toEqual([48, 96, 144]);
    expect(ticks[0]!.label).toBe('−1.6 s');
    expect(ticks[2]!.label).toBe('−4.8 s');
  });

  it('stops where history ends and handles high-DPI rows', () => {
    const rows = Array.from({ length: 100 }, (_, i) => 1000 - i * 100);
    expect(timeTicks(rows, 400, 2).map((t) => t.label)).toEqual(['−9.6 s']);
    expect(timeTicks([], 400, 1)).toEqual([]);
  });
});
