import { canonical, emptyConfig, sameConfig, sameIdentity, toParamMap } from './sourceConfig';

describe('source config helpers', () => {
  it('compares configs independent of key order', () => {
    const a = { ...emptyConfig('sim'), connection: { a: 1, b: true } };
    const b = { ...emptyConfig('sim'), connection: { b: true, a: 1 } };
    expect(canonical(a)).toBe(canonical(b));
    expect(sameConfig(a, b)).toBe(true);
    expect(sameConfig(a, { ...b, deviceId: 'x' })).toBe(false);
    expect(sameConfig(a, null)).toBe(false);
  });

  it('compares identity ignoring settings', () => {
    const a = { ...emptyConfig('sim'), connection: { a: 1 } };
    const b = { ...a, settings: { centerHz: 5, spanHz: null, params: {} } };
    expect(sameIdentity(a, b)).toBe(true);
    expect(sameConfig(a, b)).toBe(false);
    expect(sameIdentity(a, { ...a, deviceId: 'x' })).toBe(false);
    expect(sameIdentity(a, undefined)).toBe(false);
  });

  it('compares identity by device id when both have one, else by connection', () => {
    const cfg = (deviceId: string | null, connection: Record<string, string> = {}) => ({
      ...emptyConfig('sa430'),
      deviceId,
      connection,
    });
    const cases: [ReturnType<typeof cfg>, ReturnType<typeof cfg>, boolean][] = [
      [cfg('S1'), cfg('S1'), true],
      [cfg('S1', { port: '/dev/ttyACM0' }), cfg('S1', { port: '/dev/ttyACM1' }), true],
      [cfg('S1'), cfg('S2'), false],
      [cfg(null, { port: 'p' }), cfg(null, { port: 'p' }), true],
      [cfg(null, { port: 'p' }), cfg(null, { port: 'q' }), false],
      // resolved config (serial) vs stored config (no id) are different identities
      [cfg('S1', { port: 'p' }), cfg(null, { port: 'p' }), false],
      [cfg(null, { port: 'p' }), cfg('S1', { port: 'p' }), false],
    ];
    for (const [x, y, expected] of cases) expect(sameIdentity(x, y)).toBe(expected);
    expect(sameIdentity(cfg('S1'), { ...cfg('S1'), driverId: 'other' })).toBe(false);
  });

  it('drops undefined parameters', () => {
    expect(toParamMap({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});
