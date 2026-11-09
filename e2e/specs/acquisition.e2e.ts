import { $, $$, browser, expect } from '@wdio/globals';

import {
  sessionState,
  acquireState,
  byTestId,
  ensureDisconnected,
  livenessKind,
  runSimulator,
  setInput,
  sourceButtonText,
  statusBarText,
  waitForState,
} from './helpers';

describe('Simulator acquisition workflow', () => {
  it('starts disconnected with no data shown as live', async () => {
    expect(await sessionState()).toBe('Disconnected');
    expect(await livenessKind()).toBe('noSource');
    // First run: nothing remembered, so the button invites a choice and Run has nothing to run.
    expect(await sourceButtonText()).toContain('Choose a source');
    await expect(await byTestId('acquire-button')).toBeDisabled();
    await expect(await byTestId('connect-button')).not.toBeExisting();
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
  });

  it('connects to the simulator and shows a live, labelled spectrum', async () => {
    await runSimulator();
    await expect(await byTestId('simulated-badge')).toBeDisplayed();
    await browser.waitUntil(async () => (await statusBarText()).includes('FFT 4096'));
    const status = await statusBarText();
    expect(status).toContain('dBFS');
    expect(status).toContain('Uncalibrated');
    expect(status).toContain('Center 100.0000');
  });

  it('detects the strongest simulated tone as the first peak', async () => {
    await browser.waitUntil(
      async () => (await $$('[data-testid="peak-table"] tbody tr')).length > 1,
    );
    const first = (await $$('[data-testid="peak-table"] tbody tr'))[0]!;
    const text = await first.getText();
    expect(text).toMatch(/P1\s*100\.25\d* MHz\s*-20\.\d dBFS/);
  });

  it('applies processing settings and reflects them in the frame metadata', async () => {
    await $('#fft-size').selectByAttribute('value', '1024');
    await browser.waitUntil(async () => (await statusBarText()).includes('FFT 1024'), {
      timeoutMsg: 'status bar did not show the new FFT size',
    });
    await $('#window').selectByAttribute('value', 'flatTop');
    await browser.waitUntil(async () => (await statusBarText()).includes('Flat top'));
  });

  it('retunes the centre frequency and rejects out-of-range input', async () => {
    await setInput('input[aria-label="Center frequency"]', '433.92M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 433.92'), {
      timeoutMsg: 'status bar did not show the new centre frequency',
    });
    await setInput('input[aria-label="Center frequency"]', '7G');
    await expect($('input[aria-label="Center frequency"]')).toHaveAttribute('aria-invalid', 'true');
    await browser.keys(['Escape']);
    expect(await statusBarText()).toContain('Center 433.92');
  });

  it('places a marker with peak search', async () => {
    await setInput('input[aria-label="Center frequency"]', '100M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 100.0000'));
    const peakSearch = await byTestId('peak-search');
    await peakSearch.waitForEnabled(); // enabled once the readouts see the new frame's peaks
    await peakSearch.click();
    const row = (await $$('[data-testid="marker-table"] tbody tr'))[0]!;
    await expect(row).toHaveText(expect.stringContaining('M1'));
    await expect(row).toHaveText(expect.stringContaining('100.25'));
  });

  it('pauses: the last trace stays on screen, frozen and marked as held', async () => {
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
    expect(await acquireState()).toBe('idle');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe('Start acquisition');
    await browser.waitUntil(async () => (await livenessKind()) === 'stopped');
    await expect(await byTestId('plot-liveness')).toHaveText(expect.stringContaining('HOLD'));
  });

  it('plays again with the same settings', async () => {
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    expect(await acquireState()).toBe('acquiring');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe('Pause acquisition');
    expect(await statusBarText()).toContain('Center 100.0000');
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
  });

  it('keeps keyboard focus on Play/Pause across Space and Enter presses', async () => {
    const focusedTestId = () =>
      browser.execute(() => document.activeElement?.getAttribute('data-testid') ?? null);
    await browser.execute(() =>
      (document.querySelector('[data-testid="acquire-button"]') as HTMLElement).focus(),
    );
    await browser.keys([' ']);
    await waitForState('Acquiring');
    expect(await focusedTestId()).toBe('acquire-button');
    await browser.keys(['Enter']);
    await waitForState('Connected');
    expect(await focusedTestId()).toBe('acquire-button');
    await browser.keys([' ']);
    await waitForState('Acquiring');
    expect(await focusedTestId()).toBe('acquire-button');
    await browser.keys(['Enter']);
    await waitForState('Connected');
    expect(await focusedTestId()).toBe('acquire-button');
  });

  it('disconnects and releases the source', async () => {
    await ensureDisconnected();
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
    // The source stays selected, but Play needs a connected device, so it is disabled.
    expect(await sourceButtonText()).toContain('Signal simulator');
    await expect(await byTestId('acquire-button')).toBeDisabled();
  });
});
