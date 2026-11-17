import { formatFrameRate } from './rate';

describe('formatFrameRate', () => {
  it('shows one decimal and the unit', () => {
    expect(formatFrameRate(12.46)).toBe('12.5 fps');
    expect(formatFrameRate(0)).toBe('0.0 fps');
  });
});
