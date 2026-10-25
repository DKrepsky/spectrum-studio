import { $, browser, expect } from '@wdio/globals';

import {
  byTestId,
  ensureDisconnected,
  runSimulator,
  setInput,
  statusBarText,
  waitForAppReady,
  waitForState,
} from './helpers';

describe('Saved configurations and preferences', () => {
  it('saves the current setup as a named configuration', async () => {
    await runSimulator();
    await setInput('input[aria-label="Center frequency"]', '99.5M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 99.5'));
    await (await byTestId('sources-button')).click();
    await (await byTestId('save-current')).click();
    await setInput('input[aria-label="Configuration name"]', 'E2E FM setup');
    await expect(await byTestId('saved-details')).toHaveText(
      expect.stringContaining('E2E FM setup'),
    );
    await browser.keys(['Escape']);
    await ensureDisconnected();
  });

  it('changes display preferences', async () => {
    await $('#range').click();
    await setInput('#range', '90');
    await $('select[aria-label="Waterfall palette"]').selectByAttribute('value', 'viridis');
    // Preferences are saved after a short debounce.
    await browser.pause(1500);
  });

  it('restores preferences and saved configurations after a restart', async () => {
    await browser.reloadSession();
    await waitForAppReady();
    await expect(await byTestId('session-state')).toHaveText('Disconnected');
    await expect($('#range')).toHaveValue('90');
    await expect($('select[aria-label="Waterfall palette"]')).toHaveValue('viridis');

    const select = await byTestId('source-select');
    await browser.waitUntil(async () => (await select.getText()).includes('E2E FM setup'));
    await select.selectByVisibleText('E2E FM setup');
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 99.5'), {
      timeoutMsg: 'saved centre frequency was not restored',
    });
    await ensureDisconnected();
  });
});
