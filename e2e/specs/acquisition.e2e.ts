import { $, $$, browser, expect } from '@wdio/globals';

import {
  acquireState,
  byTestId,
  captureMode,
  chooseMode,
  ensureDisconnected,
  frameSeq,
  livenessKind,
  livenessText,
  runSimulator,
  sessionState,
  settledFrameSeq,
  setInput,
  sourceButtonText,
  statusBarText,
  waitForGone,
  waitForLaunchSettled,
  waitForState,
} from './helpers';

describe('Simulator acquisition workflow', () => {
  it('starts disconnected with no data shown as live', async () => {
    // An attached analyzer connects by itself at launch (ADR 0014); this spec then releases it.
    await waitForLaunchSettled();
    const autoConnected = (await sessionState()) === 'Connected';
    await ensureDisconnected();
    expect(await sessionState()).toBe('Disconnected');
    expect(await livenessKind()).toBe('noSource');
    // First run (no analyzer attached): nothing remembered, so the button invites a choice.
    if (!autoConnected) expect(await sourceButtonText()).toContain('Choose a source');
    await expect(await byTestId('acquire-button')).toBeDisabled();
    await expect(await byTestId('capture-mode-button')).toBeDisabled();
    await expect(await byTestId('connect-button')).not.toBeExisting();
    // The simulator is labelled by its source name, not by a badge.
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
  });

  it('connects to the simulator and shows a live, labelled spectrum', async () => {
    await runSimulator();
    expect(await captureMode()).toBe('continuous');
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

  it('shows Center and Span first in the side panel Measurement group, not in the toolbar', async () => {
    const layout = await browser.execute(() => {
      const measurement = Array.from(document.querySelectorAll('.side-panel details')).find(
        (d) => d.querySelector('summary')?.textContent?.trim() === 'Measurement',
      );
      const labels = Array.from(measurement?.querySelectorAll('.ui-field__label') ?? []).map((l) =>
        l.textContent?.trim(),
      );
      return {
        labels,
        inToolbar: document.querySelectorAll(
          '.toolbar [data-testid="center-frequency"], .toolbar [data-testid="span-select"]',
        ).length,
      };
    });
    expect(layout.labels.slice(0, 3)).toEqual(['Center', 'Span', 'FFT size']);
    expect(layout.inToolbar).toBe(0);
  });

  it('applies a picked span and keeps keyboard focus on Span (DESIGN.md 9.8, O1)', async () => {
    const focusedLabel = () =>
      browser.execute(() => document.activeElement?.getAttribute('aria-label') ?? null);
    const span = $('#span');
    await span.click();
    await span.selectByAttribute('value', '1024000');
    // The pick sets busy = 'applying'; the backend's new span shows in the select once it lands.
    await browser.waitUntil(async () => (await span.getValue()) === '1024000', {
      timeoutMsg: 'the picked span did not reach the source',
    });
    // A native disabled select drops focus in WebKit; Span is read-only while applying instead.
    expect(await focusedLabel()).toBe('Span');
    await expect(span).not.toBeDisabled();
    await span.selectByAttribute('value', '2048000');
    await browser.waitUntil(async () => (await span.getValue()) === '2048000');
    expect(await focusedLabel()).toBe('Span');
  });

  it('applies a Source settings frequency and keeps keyboard focus in it (DESIGN.md 9.8, O1)', async () => {
    const summary = await $('summary=Source settings');
    await browser.waitUntil(async () => {
      const open = await browser.execute(
        (el) => (el.parentElement as HTMLDetailsElement).open,
        summary,
      );
      if (open) return true;
      await summary.click();
      return false;
    });
    const tone = '#source-tone1Hz';
    await setInput(tone, '100.3M');
    // The commit sets busy = 'applying'; a read-only field keeps focus while it applies.
    await browser.waitUntil(
      async () => {
        const first = (await $$('[data-testid="peak-table"] tbody tr'))[0];
        return first !== undefined && (await first.getText()).includes('100.30');
      },
      { timeoutMsg: 'the Tone 1 frequency did not reach the source' },
    );
    const focusedId = await browser.execute(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe('source-tone1Hz');
    await expect($(tone)).not.toBeDisabled();
    // Restore the simulator's default tone for the specs that follow.
    await setInput(tone, '100.25M');
    await browser.waitUntil(async () => (await (await $(tone)).getValue()) === '100.250000 MHz');
    await summary.click();
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
    // Enter commits and keeps focus in the field (DESIGN.md 9.8, O1).
    const focused = await browser.execute(
      () => document.activeElement?.getAttribute('aria-label') ?? null,
    );
    if (focused !== 'Center frequency') throw new Error(`focus after Enter is on ${focused}`);
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
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe(
      'Start continuous acquisition',
    );
    await browser.waitUntil(async () => (await livenessKind()) === 'stopped');
    expect(await livenessText()).toContain('HOLD');
  });

  it('plays again with the same settings', async () => {
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    expect(await acquireState()).toBe('acquiring');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe(
      'Pause continuous acquisition',
    );
    expect(await statusBarText()).toContain('Center 100.0000');
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
  });

  it('keeps keyboard focus on the capture button across Space and Enter presses', async () => {
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

  it('offers Continuous and Single in the capture menu; Escape keeps the mode', async () => {
    // Keyboard only: the chevron opens the menu on the checked item, arrows move, Escape closes.
    await browser.execute(() =>
      (document.querySelector('[data-testid="capture-mode-button"]') as HTMLElement).focus(),
    );
    await browser.keys(['ArrowDown']);
    await byTestId('capture-mode-menu').waitForDisplayed();
    expect(await byTestId('capture-mode-continuous').getAttribute('aria-checked')).toBe('true');
    expect(await byTestId('capture-mode-single').getAttribute('aria-checked')).toBe('false');
    await browser.keys(['ArrowDown']);
    await browser.keys(['Escape']);
    await waitForGone('capture-mode-menu');
    expect(await captureMode()).toBe('continuous');
    // Escape returns focus to the chevron, so the keyboard user keeps their place.
    expect(
      await browser.execute(() => document.activeElement?.getAttribute('data-testid') ?? null),
    ).toBe('capture-mode-button');
    expect(await sessionState()).toBe('Connected');
  });

  it('switches to Single from the menu without starting a capture', async () => {
    await chooseMode('single');
    expect(await sessionState()).toBe('Connected');
    expect(await acquireState()).toBe('idle');
    expect(await byTestId('acquire-button').getAttribute('aria-label')).toBe(
      'Start single capture',
    );
    expect(await livenessKind()).toBe('stopped');
  });

  it('a single capture takes exactly one sweep and stops by itself', async () => {
    // The baseline must be the newest frame: the status bar may still show one from the stream
    // that just stopped (see settledFrameSeq).
    const before = await settledFrameSeq();
    await (await byTestId('acquire-button')).click();
    // The simulator sweep is near-instant: the end is the backend returning to Connected with
    // one new frame, without any Stop press.
    await browser.waitUntil(
      async () => (await sessionState()) === 'Connected' && (await frameSeq()) === before! + 1,
      { timeoutMsg: 'the single capture did not deliver exactly one frame and stop' },
    );
    expect(await acquireState()).toBe('idle');
    // Nothing else arrives afterwards: the capture really stopped.
    await browser.pause(1500);
    expect(await frameSeq()).toBe(before! + 1);
    expect(await sessionState()).toBe('Connected');
    expect(await livenessText()).toContain('HOLD');
  });

  it('a second press takes a new single capture', async () => {
    const before = await settledFrameSeq();
    await (await byTestId('acquire-button')).click();
    await browser.waitUntil(
      async () => (await sessionState()) === 'Connected' && (await frameSeq()) === before! + 1,
      { timeoutMsg: 'the second single capture did not deliver a new frame' },
    );
    expect(await acquireState()).toBe('idle');
  });

  it('cannot change the mode while acquiring; the chevron is locked', async () => {
    await chooseMode('continuous');
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    expect(await byTestId('capture-mode-button').getAttribute('aria-disabled')).toBe('true');
    await (await byTestId('capture-mode-button')).click();
    await expect(await byTestId('capture-mode-menu')).not.toBeExisting();
    expect(await captureMode()).toBe('continuous');
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
  });

  it('disconnects and releases the source', async () => {
    await ensureDisconnected();
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
    // The source stays selected, but the capture button needs a connected device, so it is disabled.
    expect(await sourceButtonText()).toContain('Signal simulator');
    await expect(await byTestId('acquire-button')).toBeDisabled();
    await expect(await byTestId('capture-mode-button')).toBeDisabled();
  });
});
