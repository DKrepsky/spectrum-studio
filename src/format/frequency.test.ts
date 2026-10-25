import { formatFrequency, formatFrequencyShort, formatLevel, parseFrequency } from './frequency';

describe('formatFrequency', () => {
  it('chooses prefix and decimals from resolution', () => {
    expect(formatFrequency(100_250_000, 500)).toBe('100.2500 MHz');
    expect(formatFrequency(100_250_000, 1)).toBe('100.250000 MHz');
    expect(formatFrequency(2.4e9, 1e6)).toBe('2.400 GHz');
    expect(formatFrequency(12_500, 100)).toBe('12.5 kHz');
    expect(formatFrequency(50, 1)).toBe('50 Hz');
  });

  it('can force a unit and handles non-finite values', () => {
    expect(formatFrequency(250_000, 1000, 1e6)).toBe('0.250 MHz');
    expect(formatFrequency(Number.NaN)).toBe('—');
  });
});

describe('formatFrequencyShort', () => {
  it('trims trailing zeros', () => {
    expect(formatFrequencyShort(2_048_000)).toBe('2.048 MHz');
    expect(formatFrequencyShort(100e6)).toBe('100 MHz');
    expect(formatFrequencyShort(-250e3)).toBe('-250 kHz');
  });
});

describe('parseFrequency', () => {
  it.each([
    ['100.2M', 100.2e6],
    ['433.92 MHz', 433.92e6],
    ['2.4g', 2.4e9],
    ['12 kHz', 12e3],
    ['100200000', 100.2e6],
    ['1e6', 1e6],
    [' .5 k ', 500],
  ])('parses %s', (text, hz) => {
    expect(parseFrequency(text)).toBeCloseTo(hz, 3);
  });

  it.each(['', 'abc', '10 xyz', '1.2.3M', 'M'])('rejects %s', (text) => {
    expect(parseFrequency(text)).toBeNull();
  });
});

describe('formatLevel', () => {
  it('formats with unit', () => {
    expect(formatLevel(-20.04, 'dBFS')).toBe('-20.0 dBFS');
    expect(formatLevel(Number.NEGATIVE_INFINITY, 'dBm')).toBe('—');
  });
});
