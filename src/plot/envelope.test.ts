import { columnEnvelope, tracePoints, valueAt } from './envelope';

const header = { startHz: 0, binHz: 1 };

describe('columnEnvelope', () => {
  it('keeps the maximum when decimating', () => {
    const trace = new Float32Array([-90, -90, -10, -90, -90, -90, -90, -50]);
    const out = columnEnvelope(trace, header, -0.5, 7.5, 2);
    expect(Array.from(out)).toEqual([-10, -50]);
  });

  it('never lowers a single-bin peak when there are about as many bins as pixels', () => {
    // 10 bins on 11 columns: a naive interpolation would show the spike at about half height.
    const trace = new Float32Array(10).fill(-80);
    trace[5] = -20;
    const out = columnEnvelope(trace, header, -0.5, 9.5, 11);
    expect(Math.max(...out)).toBe(-20);
  });

  it('marks columns outside the data as NaN', () => {
    const trace = new Float32Array([0, -10]);
    const out = columnEnvelope(trace, header, -2, 2, 8);
    expect(Number.isNaN(out[0]!)).toBe(true);
    expect(out[4]).toBe(0); // [0, 0.5) lies in bin 0
    expect(out[5]).toBe(-10); // [0.5, 1) lies in bin 1
    expect(Number.isNaN(out[7]!)).toBe(true);
  });
});

describe('tracePoints', () => {
  it('uses one vertex per bin when zoomed in', () => {
    const trace = new Float32Array([0, -10, -20, -30]);
    const { x, y } = tracePoints(trace, header, 1, 2, 100);
    expect(Array.from(y)).toEqual([-10, -20]);
    expect(Array.from(x)).toEqual([0, 100]);
    // Edges between bins include the bins just outside, so the line reaches the border.
    expect(Array.from(tracePoints(trace, header, 0.5, 2.5, 100).y)).toEqual([0, -10, -20, -30]);
  });

  it('falls back to the column envelope when bins are narrower than pixels', () => {
    const trace = new Float32Array(1000).fill(-90);
    trace[500] = -10;
    const { x, y } = tracePoints(trace, header, -0.5, 999.5, 100);
    expect(x).toHaveLength(100);
    expect(Math.max(...y)).toBe(-10);
  });
});

describe('valueAt', () => {
  it('interpolates and returns NaN outside', () => {
    const trace = new Float32Array([0, -10, -20]);
    expect(valueAt(trace, { startHz: 100, binHz: 10 }, 115)).toBeCloseTo(-15);
    expect(Number.isNaN(valueAt(trace, { startHz: 100, binHz: 10 }, 50))).toBe(true);
  });
});
