import { plotHint } from './SpectrumView';

describe('plotHint', () => {
  it('names the Continuous button for a continuous start, with no trace yet (C1)', () => {
    expect(plotHint(false, 'connected', 'continuous', 'stopped', false)).toBe(
      'No trace yet. Press Continuous to start acquisition.',
    );
  });

  it('names the Single button for a single capture, with no trace yet (C1)', () => {
    expect(plotHint(false, 'connected', 'single', 'stopped', false)).toBe(
      'No trace yet. Press Single for one sweep.',
    );
  });

  it('asks for a source when none is chosen', () => {
    expect(plotHint(true, undefined, undefined, 'noSource', false)).toBe(
      'Choose a source to begin. Try Signal simulator.',
    );
  });

  it('shows no hint once a trace is on screen, and none while connecting', () => {
    expect(plotHint(false, 'connected', 'continuous', 'live', true)).toBeNull();
    expect(plotHint(false, 'connecting', 'continuous', 'stopped', false)).toBeNull();
  });
});
