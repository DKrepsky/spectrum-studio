import { spawn, type ChildProcess } from 'node:child_process';

import { $, $$, browser, expect } from '@wdio/globals';

import {
  acquireState,
  byTestId,
  captureMode,
  chooseMode,
  closeSourceMenu,
  ensureDisconnected,
  failureBanner,
  fillDialog,
  frameSeq,
  livenessKind,
  openAddSourceDialog,
  openEditDialog,
  openSourceMenu,
  runTestConnection,
  selectSource,
  sessionState,
  setInput,
  sourceButtonText,
  statusBarText,
  textOf,
  waitForAppReady,
  waitForGone,
  waitForLaunchSettled,
  waitForState,
} from './helpers';

/**
 * Real hardware: needs a TI SA430 on USB and `SPECTRUM_E2E_SA430=1`; skipped otherwise so the
 * suite stays runnable anywhere. The device is found on `/dev/ttyACM0`.
 *
 * Automated here: the launch connects an attached analyzer (not the simulator), and a device whose
 * port is busy fails into Failed and stays selected, with no simulator fallback (ADR 0017).
 *
 * Manual (needs the cable, so not automated; ADR 0017 and docs/testing.md "Manual start-up checks"):
 *  1. Unplug the SA430 with no source connected: the simulator is not connected by itself.
 *  2. Plug it in again while the simulator is selected and idle: the device replaces it and is
 *     connected; the fixed "Signal simulator" row is no longer current.
 *  3. Start Single or Continuous on the simulator, then plug the SA430 in: the acquisition is not
 *     interrupted and the device is not connected until the simulator is stopped.
 *  4. Unplug the SA430 while it acquires: the banner says the device was lost, the device stays the
 *     selection, and no simulator is connected.
 */
const describeHardware = process.env.SPECTRUM_E2E_SA430 === '1' ? describe : describe.skip;

describeHardware('TI SA430 (real hardware)', () => {
  it('connects by itself at launch, paused: the capture button is not pressed and one row is remembered', async () => {
    // This spec file starts with nothing remembered, so the launch auto-connect (ADR 0014) takes the
    // attached analyzer: connected, remembered, paused. No detected entry is left over.
    await waitForLaunchSettled();
    await waitForState('Connected', 20_000);
    expect(await acquireState()).toBe('idle');
    expect(await livenessKind()).not.toBe('live');
    // The launch connected the analyzer, so the selection is the analyzer, not the simulator.
    expect(await sourceButtonText()).toContain('SA430');
    expect(await sourceButtonText()).not.toContain('Signal simulator');
    await openSourceMenu();
    const rows = await $$('[data-testid^="source-entry-"][aria-label*="SA430"]');
    expect(rows).toHaveLength(1);
    expect(await textOf(rows[0]!)).toMatch(/Connected/);
    await expect(await $('[data-testid^="source-detected-sa430-"]')).not.toBeExisting();
    expect(await textOf(byTestId('source-menu'))).not.toMatch(/scan\b(?!ning)/i);
    await closeSourceMenu();
  });

  it('adds it through Add source… with the real port: Test connection, then the second row is refused', async () => {
    // The launch connected the device, and a connected device cannot be tested: disconnect first.
    await ensureDisconnected();
    await openAddSourceDialog();
    await fillDialog({ name: 'E2E SA430', port: '/dev/ttyACM0' });
    const text = await runTestConnection();
    expect(text).toContain('Connection OK');
    expect(text).toMatch(/Serial number [0-9A-F]{8,}/);
    // The device is already remembered: the dialog says so and Save is refused.
    await expect(await $('[data-testid="dialog-note-warn"]')).toHaveText(
      expect.stringContaining('already in Your sources'),
    );
    await expect(await byTestId('add-source-save')).toHaveAttribute('aria-disabled', 'true');
    await (await byTestId('add-source-cancel')).click();
    await waitForGone('add-source-dialog');
    await openSourceMenu();
    expect(await $$('[data-testid^="source-entry-"][aria-label*="SA430"]')).toHaveLength(1);
    await expect(await $('[data-testid^="source-detected-sa430-"]')).not.toBeExisting();
    await closeSourceMenu();
  });

  it('renames it through Edit and still shows a single row, also after a restart', async () => {
    await openSourceMenu();
    const id = (await (await $('[data-testid^="source-entry-"]')).getAttribute('data-testid'))!;
    await closeSourceMenu();
    await openEditDialog(id);
    await fillDialog({ name: 'E2E SA430 renamed' });
    await (await byTestId('add-source-save')).click();
    await waitForGone('add-source-dialog');
    await closeSourceMenu();

    await browser.reloadSession();
    await waitForAppReady();
    await openSourceMenu();
    await browser.pause(1500);
    const rows = await $$('[data-testid^="source-entry-"]');
    expect(rows).toHaveLength(1);
    expect(await textOf(rows[0]!)).toContain('E2E SA430 renamed');
    await expect(await $('[data-testid^="source-detected-sa430-"]')).not.toBeExisting();
    await closeSourceMenu();
  });

  it('connects the remembered row and shows live calibrated dBm sweeps', async () => {
    // After the restart above the launch auto-connect has the device: release it, then connect by hand.
    await ensureDisconnected();
    await openSourceMenu();
    const device = await $('[data-testid^="source-entry-"]');
    await device.waitForExist({ timeoutMsg: 'the remembered SA430 row is missing' });
    await device.click();
    await waitForState('Connected');

    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live', { timeout: 20_000 });
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 433.9'));
    const status = await statusBarText();
    expect(status).toContain('dBm');
    expect(status).not.toContain('Uncalibrated');

    // Centre frequency restore: retune (the analyzer snaps to its step, so 434.499 is fine).
    await setInput('input[aria-label="Center frequency"]', '434.5M');
    await browser.waitUntil(async () => /Center 434\.[45]/.test(await statusBarText()));
    await ensureDisconnected();
  });

  it('restores the retuned centre frequency after a restart', async () => {
    await browser.reloadSession();
    await waitForAppReady();
    // The launch auto-connect connects the remembered device with its stored settings (paused).
    await waitForState('Connected', 20_000);
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring', 20_000);
    await browser.waitUntil(async () => /Center 434\.[45]/.test(await statusBarText()), {
      timeoutMsg: 'the remembered centre frequency was not restored',
    });
    await ensureDisconnected();
  });

  it('shows Frequency step and Reference level in Measurement, not in Source settings, and applies Frequency step', async () => {
    await ensureDisconnected();
    await openSourceMenu();
    const id = (await (await $('[data-testid^="source-entry-"]')).getAttribute('data-testid'))!;
    await selectSource(id);
    await waitForState('Connected');

    // The SA430's rows, in order: Center, Span, its two measurement settings, then Averaging (3.6).
    const sections = () =>
      browser.execute(() => {
        const details = Array.from(document.querySelectorAll('.side-panel details'));
        const named = (name: string) =>
          details.find((d) => d.querySelector('summary')?.textContent?.trim() === name);
        return {
          measurement: Array.from(
            named('Measurement')?.querySelectorAll('.ui-field__label') ?? [],
          ).map((l) => l.textContent?.trim()),
          source: named('Source settings')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
      });
    const rows = await sections();
    expect(rows.measurement).toEqual([
      'Center',
      'Span',
      'Frequency step',
      'Reference level',
      'Averaging',
    ]);
    expect(rows.source).toContain('This source has no additional settings.');

    await setInput('#measurement-stepKhz', '50');
    await browser.waitUntil(async () => (await $('#measurement-stepKhz').getValue()) === '50', {
      timeoutMsg: 'the Frequency step did not apply from the Measurement row',
    });
    await setInput('#measurement-stepKhz', '100');
    await browser.waitUntil(async () => (await $('#measurement-stepKhz').getValue()) === '100', {
      timeoutMsg: 'the Frequency step did not return to 100 kHz',
    });
    await ensureDisconnected();
  });

  it('stays disconnected after a manual disconnect: no auto-reconnect without a plug-in', async () => {
    await ensureDisconnected();
    await browser.pause(4000);
    expect(await sessionState()).toBe('Disconnected');
    expect(await acquireState()).toBe('idle');
  });

  it('captures one real sweep in Single mode and stops by itself', async () => {
    await openSourceMenu();
    const id = (await (await $('[data-testid^="source-entry-"]')).getAttribute('data-testid'))!;
    await selectSource(id);
    await waitForState('Connected');
    await chooseMode('single');
    const before = await frameSeq();
    await (await byTestId('acquire-button')).click();
    await browser.waitUntil(
      async () => (await sessionState()) === 'Connected' && (await frameSeq()) !== before,
      { timeout: 30_000, timeoutMsg: 'the single sweep did not arrive and stop' },
    );
    const status = await statusBarText();
    expect(status).toContain('dBm');
    expect(status).not.toContain('Uncalibrated');
    expect(await acquireState()).toBe('idle');
    // No further sweeps once the capture has stopped.
    const seq = await frameSeq();
    await browser.pause(2000);
    expect(await frameSeq()).toBe(seq);
    expect(await livenessKind()).toBe('stopped');
    await chooseMode('continuous');
    expect(await captureMode()).toBe('continuous');
    await ensureDisconnected();
  });

  it('cancels a single capture the moment its Cancel label appears, with no frame (BUG-1)', async () => {
    await openSourceMenu();
    const id = (await (await $('[data-testid^="source-entry-"]')).getAttribute('data-testid'))!;
    await selectSource(id);
    await waitForState('Connected');
    await chooseMode('single');
    // One completed sweep first, so the frame count the rounds compare against is a number.
    await (await byTestId('acquire-button')).click();
    await browser.waitUntil(
      async () => (await sessionState()) === 'Connected' && (await frameSeq()) !== null,
      { timeout: 30_000, timeoutMsg: 'the first sweep did not arrive' },
    );

    // Repeated so an intermittent loss of the click shows up. Each round starts a capture and,
    // in the same page task, clicks Cancel as soon as the label reads "Cancel single capture":
    // the status event can arrive before the start command resolves, which is the BUG-1 window.
    for (let round = 1; round <= 5; round++) {
      await waitForState('Connected');
      const before = await frameSeq();
      // Arms the observer, then presses Start. The observer clicks Cancel in the same page task as
      // soon as the label reads "Cancel single capture": the status event can arrive before the
      // start command resolves, which is the BUG-1 window. The outcome goes to the page's dataset.
      await browser.execute(() => {
        const button = document.querySelector<HTMLButtonElement>('[data-testid="acquire-button"]')!;
        const body = document.body.dataset;
        body['cancelOutcome'] = 'pending';
        const finish = (outcome: string) => {
          body['cancelOutcome'] = outcome;
          observer.disconnect();
          clearTimeout(timer);
        };
        const observer = new MutationObserver(() => {
          if (button.getAttribute('aria-label') !== 'Cancel single capture') return;
          button.click();
          finish('cancel-clicked');
        });
        const timer = setTimeout(() => finish('no-cancel-label'), 5000);
        observer.observe(button, { attributes: true, childList: true, subtree: true });
        button.click();
      });
      await browser.waitUntil(
        async () =>
          (await browser.execute(() => document.body.dataset['cancelOutcome'])) !== 'pending',
        { timeout: 6000, timeoutMsg: `round ${round}: the outcome was never recorded` },
      );
      const outcome = await browser.execute(() => document.body.dataset['cancelOutcome']);
      if (outcome !== 'cancel-clicked') throw new Error(`round ${round}: ${outcome}`);

      // The cancelled sweep is never shown: the state returns to Connected with the same frame.
      await waitForState('Connected', 20_000);
      await browser.waitUntil(async () => (await acquireState()) === 'idle', {
        timeoutMsg: `round ${round}: the capture did not return to idle`,
      });
      await browser.pause(300); // a frame published before the Stop would arrive within this window
      const after = await frameSeq();
      if (after !== before)
        throw new Error(`round ${round}: a frame was shown after Cancel (${before} -> ${after})`);
      expect(await sessionState()).toBe('Connected');
      // textContent, not getText(): the region is visually hidden and WebDriver omits such text.
      const announced = await browser.execute(
        () => document.querySelector('[data-testid="capture-live-region"]')?.textContent ?? '',
      );
      if (!announced.includes('cancelled'))
        throw new Error(`round ${round}: announced "${announced}"`);
    }
    await chooseMode('continuous');
    await ensureDisconnected();
  });

  it('a device whose port is busy fails into Failed and stays selected, with no simulator fallback', async () => {
    await ensureDisconnected();
    await openSourceMenu();
    const id = (await (
      await $('[data-testid^="source-entry-"][aria-label*="SA430"]')
    ).getAttribute('data-testid'))!;
    await closeSourceMenu();

    // Another process holds the port exclusively (TIOCEXCL, as the serial driver's own open does).
    const holder = await holdPort(DEVICE_PORT);
    try {
      await selectSource(id);
      await (await failureBanner()).waitForDisplayed();
      expect(await sessionState()).toBe('Disconnected');
      const name = await sourceButtonText();
      expect(name).toContain('SA430');
      expect(name).toMatch(/, Failed$/);
      expect(name).not.toContain('Signal simulator');
      await openSourceMenu();
      expect(await textOf(byTestId(id))).toContain('Failed');
      await closeSourceMenu();
    } finally {
      await releasePort(holder);
    }

    // Once the port is free the same row connects: nothing was forgotten or replaced.
    await selectSource(id);
    await waitForState('Connected', 20_000);
    await ensureDisconnected();
  });
});

const DEVICE_PORT = '/dev/ttyACM0';

/** Opens the port with an exclusive lock in a helper process and resolves once it is held. */
async function holdPort(port: string): Promise<ChildProcess> {
  const script = `
import fcntl, os, sys, termios, time
fd = os.open(sys.argv[1], os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
fcntl.ioctl(fd, termios.TIOCEXCL)
print("held", flush=True)
time.sleep(600)
`;
  const child = spawn('python3', ['-I', '-c', script, port], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    child.stdout!.once('data', () => resolve());
    child.once('exit', (code) => reject(new Error(`the port holder exited with ${code}`)));
  });
  return child;
}

/** Stops the port holder and waits until the port is released. */
async function releasePort(child: ChildProcess) {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });
}
