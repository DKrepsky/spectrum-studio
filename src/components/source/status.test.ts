import { activeStatus, showsFailed } from './status';

describe('source status', () => {
  it.each([
    ['connected', null, true, false, 'connected'],
    ['acquiring', null, true, false, 'acquiring'],
    ['connecting', null, true, false, 'connecting'],
    ['disconnected', 'connecting', true, false, 'connecting'],
    ['disconnected', null, true, false, 'failed'],
    ['disconnected', null, false, true, 'absent'],
    ['disconnected', null, false, false, 'idle'],
  ] as const)(
    'backend %s with busy %s and failed %s is %s',
    (state, busy, failed, lost, expected) => {
      expect(activeStatus(state, busy, failed, lost)).toBe(expected);
    },
  );

  it('shows a failed marker only while the backend is disconnected and not connecting', () => {
    expect(showsFailed('disconnected', null, true)).toBe(true);
    expect(showsFailed('connected', null, true)).toBe(false);
    expect(showsFailed('acquiring', null, true)).toBe(false);
    expect(showsFailed('connecting', null, true)).toBe(false);
    expect(showsFailed('disconnected', 'connecting', true)).toBe(false);
    expect(showsFailed('disconnected', null, false)).toBe(false);
  });
});
