import { $, $$, browser, expect } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  fillDialog,
  livenessKind,
  openAddSourceDialog,
  openEditDialog,
  openSourceMenu,
  runTestConnection,
  setInput,
  statusBarText,
  textOf,
  waitForAppReady,
  waitForState,
} from './helpers';

/**
 * Real hardware: needs a TI SA430 on USB and `SPECTRUM_E2E_SA430=1`; skipped otherwise so the
 * suite stays runnable anywhere.
 */
const describeHardware = process.env.SPECTRUM_E2E_SA430 === '1' ? describe : describe.skip;

describeHardware('TI SA430 (real hardware)', () => {
  it('detects the analyzer in the open menu without any scan button', async () => {
    await openSourceMenu();
    const device = await $('[data-testid^="source-detected-sa430-"]');
    await device.waitForExist({ timeoutMsg: 'no SA430 was detected' });
    expect(await textOf(device)).toMatch(/SA430/);
    expect(await textOf(byTestId('source-menu'))).not.toMatch(/scan\b(?!ning)/i);
    await closeSourceMenu();
  });

  it('adds it through Add source… with the real port: Test connection, then Save', async () => {
    await openAddSourceDialog();
    await fillDialog({ name: 'E2E SA430', port: '/dev/ttyACM0' });
    const text = await runTestConnection();
    expect(text).toContain('Connection OK');
    expect(text).toMatch(/Serial number [0-9A-F]{8,}/);
    await (await byTestId('add-source-save')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    // Remembered and detected are the same device: one row, no separate detected entry.
    expect(await $$('[data-testid^="source-entry-"]')).toHaveLength(1);
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
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
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
    await openSourceMenu();
    const device = await $('[data-testid^="source-entry-"]');
    await device.waitForExist({ timeoutMsg: 'the remembered SA430 row is missing' });
    await device.click();
    await waitForState('Connected');
    await expect(await byTestId('simulated-badge')).not.toBeExisting();

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
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring', 20_000);
    await browser.waitUntil(async () => /Center 434\.[45]/.test(await statusBarText()), {
      timeoutMsg: 'the remembered centre frequency was not restored',
    });
    await ensureDisconnected();
  });
});
