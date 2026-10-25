import type { DecodedFrame } from '../ipc/frame';
import { STALE_AFTER_MS, liveness } from './liveness';

const frame = { receivedAt: 1000, header: { timestampMs: 0 } } as unknown as DecodedFrame;

describe('liveness', () => {
  it('is live only while acquiring with fresh frames', () => {
    expect(liveness('acquiring', frame, 1500).kind).toBe('live');
    expect(liveness('acquiring', frame, 1000 + STALE_AFTER_MS + 1).kind).toBe('stale');
    expect(liveness('acquiring', null, 0).kind).toBe('waiting');
  });

  it('marks retained frames as held when not acquiring', () => {
    expect(liveness('connected', frame, 1500).kind).toBe('stopped');
    expect(liveness('connected', frame, 1500).label).toMatch(/^HOLD/);
    expect(liveness('disconnected', frame, 1500).kind).toBe('stopped');
    expect(liveness('disconnected', null, 1500).kind).toBe('noSource');
    expect(liveness('connected', null, 1500).label).toBe('Stopped');
  });
});
