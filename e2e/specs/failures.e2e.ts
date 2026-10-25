import { $, browser, expect } from '@wdio/globals';

import {
  byTestId,
  ensureDisconnected,
  livenessKind,
  runSimulator,
  setInput,
  waitForState,
} from './helpers';

describe('Failure handling', () => {
  it('reports a failed connection and stays disconnected', async () => {
    await (await byTestId('sources-button')).click();
    await (await byTestId('driver-simulator')).click();
    await $('#conn-simulator-failConnect').click();
    await (await byTestId('manager-connect')).click();
    const notice = await byTestId('session-notice');
    await expect(notice).toBeDisplayed();
    await expect(notice).toHaveText(expect.stringContaining('Could not connect'));
    await expect(await byTestId('session-state')).toHaveText('Disconnected');
    await browser.keys(['Escape']);
    await (await $('[data-testid="session-notice"] button[aria-label="Dismiss"]')).click();
  });

  it('detects device loss during acquisition and recovers with Reconnect', async () => {
    // The failed attempt above left the failing configuration selected; pick the plain simulator.
    await (await byTestId('source-select')).selectByAttribute('value', 'driver:simulator');
    await runSimulator();
    await $('summary=Source settings').click();
    await setInput('#source-faultAfterS', '1');
    await waitForState('Disconnected');
    const notice = await byTestId('session-notice');
    await expect(notice).toHaveText(expect.stringContaining('Simulated device loss'));
    expect(await livenessKind()).not.toBe('live');

    await (await byTestId('reconnect-button')).click();
    await waitForState('Connected');
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    await $('summary=Source settings').click();
    await ensureDisconnected();
  });

  it('lists planned integrations honestly without a connect action', async () => {
    await (await byTestId('sources-button')).click();
    await (await byTestId('driver-soapysdr')).click();
    await expect(await byTestId('planned-notice')).toHaveText(
      expect.stringContaining('Not implemented yet'),
    );
    await expect(await byTestId('manager-connect')).not.toBeExisting();
    await browser.keys(['Escape']);
  });
});
