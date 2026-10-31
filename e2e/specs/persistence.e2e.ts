import { $, browser, expect } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  fillDialog,
  openEditDialog,
  openSourceMenu,
  runSimulator,
  selectSource,
  setInput,
  sourceButtonText,
  revealRowActions,
  statusBarText,
  textOf,
  waitForAppReady,
  waitForState,
} from './helpers';

/** The test id of the one remembered source (the simulator), once it has been remembered. */
async function simulatorEntryId(): Promise<string> {
  const entry = await simulatorEntry();
  return (await entry.getAttribute('data-testid')) ?? '';
}

async function simulatorEntry() {
  const entry = await $('[data-testid^="source-entry-"]');
  await entry.waitForExist({ timeoutMsg: 'the simulator was not remembered' });
  return entry;
}

describe('Remembered sources and preferences', () => {
  it('remembers a source automatically, with the settings it was last used with', async () => {
    await runSimulator();
    await setInput('input[aria-label="Center frequency"]', '99.5M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 99.5'));
    await ensureDisconnected();
    await openSourceMenu();
    expect(await textOf(simulatorEntry())).toContain('Signal simulator');
    // Once remembered, the fixed "Signal simulator" row is gone.
    await expect(await byTestId('source-simulator')).not.toBeExisting();
    await closeSourceMenu();
  });

  it('renames a remembered source through the Edit dialog', async () => {
    await openSourceMenu();
    const id = await simulatorEntryId();
    await openEditDialog(id);
    await fillDialog({ name: 'E2E FM setup' });
    await (await byTestId('add-source-save')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    // Saving returns to the menu with the renamed row.
    expect(await textOf(simulatorEntry())).toContain('E2E FM setup');
    await closeSourceMenu();
    await browser.waitUntil(async () => (await sourceButtonText()).includes('E2E FM setup'));
  });

  it('forgets a source and brings it back with Undo', async () => {
    await openSourceMenu();
    const id = (await simulatorEntryId()).replace('source-entry-', '');
    await (await revealRowActions(`source-entry-${id}`)).$('[data-testid="source-forget"]').click();
    await expect(await byTestId(`source-entry-${id}`)).not.toBeExisting();
    await (await byTestId('source-undo')).click();
    await expect(await byTestId(`source-entry-${id}`)).toBeExisting();
    expect(await textOf(byTestId(`source-entry-${id}`))).toContain('E2E FM setup');
    await closeSourceMenu();
  });

  it('changes display preferences', async () => {
    await $('#range').click();
    await setInput('#range', '90');
    await $('select[aria-label="Waterfall palette"]').selectByAttribute('value', 'viridis');
    // Preferences are saved after a short debounce.
    await browser.pause(1500);
  });

  it('restores preferences, the last source and its settings after a restart', async () => {
    await browser.reloadSession();
    await waitForAppReady();
    await expect(await byTestId('session-state')).toHaveText('Disconnected');
    await expect($('#range')).toHaveValue('90');
    await expect($('select[aria-label="Waterfall palette"]')).toHaveValue('viridis');

    // The last source is selected again, but the app never connects by itself.
    await browser.waitUntil(async () => (await sourceButtonText()).includes('E2E FM setup'), {
      timeoutMsg: 'the last source was not restored as the selection',
    });
    await expect(await byTestId('session-state')).toHaveText('Disconnected');

    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 99.5'), {
      timeoutMsg: 'the remembered centre frequency was not restored',
    });
    await ensureDisconnected();
    await openSourceMenu();
    await selectSource(await simulatorEntryId());
    await waitForState('Connected');
    await ensureDisconnected();
  });
});
