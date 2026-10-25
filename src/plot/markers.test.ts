import type { Peak } from '../bindings/Peak';
import type { DecodedFrame } from '../ipc/frame';
import { nextPeak, readMarkers } from './markers';

const frame = {
  header: { startHz: 0, binHz: 10 },
  live: new Float32Array([-90, -20, -90, -50]),
} as unknown as DecodedFrame;

const peak = (frequencyHz: number, amplitude: number): Peak => ({
  frequencyHz,
  amplitude,
  bin: 0,
  prominenceDb: 10,
});

describe('readMarkers', () => {
  it('reads levels and deltas to marker 1', () => {
    const readings = readMarkers(frame, [
      { id: 1, frequencyHz: 10 },
      { id: 2, frequencyHz: 30 },
    ]);
    expect(readings[0]!.level).toBe(-20);
    expect(readings[0]!.delta).toBeNull();
    expect(readings[1]!.delta).toEqual({ hz: 20, db: -30 });
  });

  it('yields NaN without a frame', () => {
    expect(Number.isNaN(readMarkers(null, [{ id: 1, frequencyHz: 0 }])[0]!.level)).toBe(true);
  });
});

describe('nextPeak', () => {
  const peaks = [peak(100, -10), peak(200, -20), peak(300, -30)];
  it('walks peaks from strongest to weakest', () => {
    expect(nextPeak(peaks, null, 1)?.frequencyHz).toBe(100);
    expect(nextPeak(peaks, 100.4, 1)?.frequencyHz).toBe(200);
    expect(nextPeak(peaks, 300, 1)).toBeNull();
    expect(nextPeak(peaks, 150, 1)?.frequencyHz).toBe(100);
    expect(nextPeak([], 0, 1)).toBeNull();
  });
});
