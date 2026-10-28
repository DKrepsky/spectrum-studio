import { $, browser, expect } from '@wdio/globals';

import { byTestId, ensureDisconnected, livenessKind, statusBarText, waitForState } from './helpers';

/**
 * Real hardware: needs a TI SA430 on USB and `SPECTRUM_E2E_SA430=1`; skipped otherwise so the
 * suite stays runnable anywhere.
 */
const describeHardware = process.env.SPECTRUM_E2E_SA430 === '1' ? describe : describe.skip;

describeHardware('TI SA430 (real hardware)', () => {
  it('finds the analyzer, connects and shows live calibrated dBm sweeps', async () => {
    await (await byTestId('sources-button')).click();
    await (await byTestId('driver-sa430')).click();
    await $('button=Scan').click();
    const device = await $('input[name="device"]');
    await device.waitForExist({ timeoutMsg: 'no SA430 was discovered' });
    await device.click();
    await (await byTestId('manager-connect')).click();
    await waitForState('Connected');
    await expect(await byTestId('simulated-badge')).not.toBeExisting();

    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live', { timeout: 20_000 });
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 433.9'));
    const status = await statusBarText();
    expect(status).toContain('dBm');
    expect(status).not.toContain('Uncalibrated');
    await ensureDisconnected();
  });
});
