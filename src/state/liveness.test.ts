import type { SessionState } from '../bindings/SessionState';
import type { DecodedFrame } from '../ipc/frame';
import { STALE_AFTER_MS, liveness } from './liveness';

const frame = { receivedAt: 1000, header: { timestampMs: 0 } } as unknown as DecodedFrame;
const FRESH = 1500;
const STALE = 1000 + STALE_AFTER_MS + 1;

describe('liveness', () => {
  it('is live only while acquiring continuously with fresh frames', () => {
    expect(liveness('acquiring', frame, FRESH, 'continuous').kind).toBe('live');
    expect(liveness('acquiring', frame, FRESH, 'continuous').label).toBe('LIVE');
    expect(liveness('acquiring', frame, STALE, 'continuous').kind).toBe('stale');
    expect(liveness('acquiring', null, 0, 'continuous').kind).toBe('waiting');
  });

  it('defaults to the continuous behaviour when the mode is unknown', () => {
    expect(liveness('acquiring', frame, FRESH, undefined).kind).toBe('live');
    expect(liveness('acquiring', frame, STALE, undefined).kind).toBe('stale');
  });

  it('marks retained frames as held when connected but not acquiring', () => {
    expect(liveness('connected', frame, FRESH, 'continuous').kind).toBe('stopped');
    expect(liveness('connected', frame, FRESH, 'continuous').label).toMatch(/^HOLD/);
    expect(liveness('connected', null, FRESH, 'continuous').label).toBe('Stopped');
  });

  it('says no source is connected after Disconnect, even while a held trace stays on screen (S13)', () => {
    expect(liveness('disconnected', frame, FRESH, 'continuous')).toEqual({
      kind: 'noSource',
      label: 'No source connected',
    });
    expect(liveness('disconnected', null, FRESH, 'continuous')).toEqual({
      kind: 'noSource',
      label: 'No source connected',
    });
  });

  it("keeps a lost device's trace as HOLD (S10), but not a disconnected one", () => {
    expect(liveness('disconnected', frame, FRESH, 'continuous', true).label).toMatch(/^HOLD/);
    expect(liveness('disconnected', frame, FRESH, 'continuous', false).kind).toBe('noSource');
  });

  describe('single capture', () => {
    it('shows CAPTURING while acquiring, with or without a frame', () => {
      const capturing = liveness('acquiring', null, 0, 'single');
      expect(capturing).toEqual({ kind: 'capturing', label: 'CAPTURING' });
      expect(liveness('acquiring', frame, FRESH, 'single')).toEqual(capturing);
    });

    it('never reports LIVE or stale while acquiring', () => {
      for (const now of [0, FRESH, STALE, STALE + 60_000]) {
        const result = liveness('acquiring', frame, now, 'single');
        expect(result.kind).toBe('capturing');
        expect(result.label).not.toBe('LIVE');
        expect(result.label).not.toMatch(/^No data/);
      }
    });

    it('behaves like continuous once not acquiring', () => {
      const states: SessionState[] = ['disconnected', 'connecting', 'connected', 'disconnecting'];
      for (const state of states) {
        for (const data of [frame, null]) {
          expect(liveness(state, data, FRESH, 'single')).toEqual(
            liveness(state, data, FRESH, 'continuous'),
          );
        }
      }
    });
  });
});
