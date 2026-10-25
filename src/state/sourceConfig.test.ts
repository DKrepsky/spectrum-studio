import type { ActiveSource } from '../bindings/ActiveSource';
import {
  canonical,
  emptyConfig,
  findSaved,
  sameConfig,
  snapshotConfig,
  toParamMap,
} from './sourceConfig';

describe('source config helpers', () => {
  it('compares configs independent of key order', () => {
    const a = { ...emptyConfig('sim'), connection: { a: 1, b: true } };
    const b = { ...emptyConfig('sim'), connection: { b: true, a: 1 } };
    expect(canonical(a)).toBe(canonical(b));
    expect(sameConfig(a, b)).toBe(true);
    expect(sameConfig(a, { ...b, deviceId: 'x' })).toBe(false);
    expect(sameConfig(a, null)).toBe(false);
  });

  it('snapshots the active settings and finds saved matches', () => {
    const active = {
      config: emptyConfig('simulator'),
      settings: { centerHz: 1e6, spanHz: 2e6, params: { seed: 3 } },
    } as unknown as ActiveSource;
    const snap = snapshotConfig(active);
    expect(snap.settings).toEqual({ centerHz: 1e6, spanHz: 2e6, params: { seed: 3 } });
    const saved = [{ id: 'a', name: 'A', config: snap, createdMs: 0, updatedMs: 0 }];
    expect(findSaved(saved, snapshotConfig(active))?.id).toBe('a');
    expect(findSaved(saved, emptyConfig('simulator'))).toBeUndefined();
  });

  it('drops undefined parameters', () => {
    expect(toParamMap({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});
