import { $, $$, browser, expect } from '@wdio/globals';

import {
  byTestId,
  ensureDisconnected,
  livenessKind,
  selectSource,
  statusBarText,
  waitForState,
} from './helpers';

// Seeded sources (e2e/fixtures/seed/files/sources.json) point at e2e/fixtures/recordings. The
// native file dialog behind "Open file…" cannot be driven through WebDriver; its routing by file
// extension is covered by the Vitest component tests.
describe('Recordings', () => {
  it('replays a SigMF IQ recording through the FFT pipeline', async () => {
    await selectSource('source-entry-seed-iq');
    await waitForState('Connected');
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
    await expect($('input[aria-label="Center frequency"]')).toBeDisabled();
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 145.0000'));
    const peak = (await $$('[data-testid="peak-table"] tbody tr'))[0]!;
    await expect(peak).toHaveText(expect.stringMatching(/145\.010+ MHz\s*-6\.0 dBFS/));
    await ensureDisconnected();
  });

  it('shows a CSV trace as supplied, in its own unit, and marks it as not live', async () => {
    await selectSource('source-entry-seed-trace');
    await waitForState('Connected');
    await expect($('#fft-size')).toBeDisabled();
    await (await byTestId('run-button')).click();
    await browser.waitUntil(async () => (await statusBarText()).includes('dBm'));
    await waitForState('Connected');
    await expect(await byTestId('session-notice')).toHaveText(
      expect.stringContaining('end of the recording'),
    );
    expect(await livenessKind()).toBe('stopped');
    const status = await statusBarText();
    expect(status).toContain('Points 101');
    expect(status).not.toContain('Uncalibrated');
    await ensureDisconnected();
  });
});
