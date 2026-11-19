import { plotHint } from './SpectrumView';

describe('plotHint', () => {
  it('names the Continuous button for a continuous start, with no trace yet (C1)', () => {
    expect(plotHint('ready', 'connected', 'continuous', 'stopped', false)).toBe(
      'No trace yet. Press Continuous to start acquisition.',
    );
  });

  it('names the Single button for a single capture, with no trace yet (C1)', () => {
    expect(plotHint('ready', 'connected', 'single', 'stopped', false)).toBe(
      'No trace yet. Press Single for one sweep.',
    );
  });

  it('asks the user to connect when the selected source is not connected (S13)', () => {
    expect(plotHint('ready', 'disconnected', 'continuous', 'noSource', false)).toBe(
      'Not connected. Use the source button to connect.',
    );
  });

  it('shows no hint during start-up, loading or unavailable (S0, S12)', () => {
    expect(plotHint('loading', undefined, undefined, 'noSource', false)).toBeNull();
    expect(plotHint('unavailable', undefined, undefined, 'noSource', false)).toBeNull();
  });

  it('shows no hint once a trace is on screen, and none while connecting', () => {
    expect(plotHint('ready', 'connected', 'continuous', 'live', true)).toBeNull();
    expect(plotHint('ready', 'disconnected', 'continuous', 'noSource', true)).toBeNull();
    expect(plotHint('ready', 'connecting', 'continuous', 'stopped', false)).toBeNull();
  });
});
