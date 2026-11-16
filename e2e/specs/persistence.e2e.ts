import { $, browser, expect } from '@wdio/globals';

import {
  sessionState,
  byTestId,
  captureMode,
  chooseMode,
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

/**
 * The simulator's remembered row. An attached analyzer is remembered too (launch auto-connect,
 * ADR 0014), so the row is the one that is not the SA430.
 */
async function simulatorEntry() {
  const entry = await $('[data-testid^="source-entry-"]:not([data-label*="SA430"])');
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

  it('changes display preferences and the capture mode', async () => {
    await $('#range').click();
    await setInput('#range', '90');
    await $('select[aria-label="Waterfall palette"]').selectByAttribute('value', 'viridis');
    // Display preferences are saved after a short debounce.
    await browser.pause(1500);
    // The capture control needs a connected source; the mode is saved as soon as it is chosen.
    await openSourceMenu();
    await selectSource(await simulatorEntryId());
    await waitForState('Connected');
    await chooseMode('single');
    await ensureDisconnected();
  });

  it('restores preferences, the last source and its settings after a restart', async () => {
    await browser.reloadSession();
    await waitForAppReady();
    await expect($('#range')).toHaveValue('90');
    await expect($('select[aria-label="Waterfall palette"]')).toHaveValue('viridis');
    // The capture mode chosen before the restart is shown again (Single).
    expect(await captureMode()).toBe('single');

    // An attached analyzer is connected by the launch auto-connect (ADR 0014) and then selected;
    // without one the last source is selected again but not connected. Either way the simulator
    // is connected by hand below, with the settings remembered for it.
    if ((await sessionState()) === 'Connected') {
      expect(await sourceButtonText()).toContain('SA430');
      await ensureDisconnected();
    } else {
      expect(await sessionState()).toBe('Disconnected');
      await browser.waitUntil(async () => (await sourceButtonText()).includes('E2E FM setup'), {
        timeoutMsg: 'the last source was not restored as the selection',
      });
    }
    // Play is disabled until a device is connected: connect the simulator first.
    await openSourceMenu();
    await selectSource(await simulatorEntryId());
    await waitForState('Connected');

    // Single: one press delivers one sweep with the remembered centre, then the session stops.
    await (await byTestId('acquire-button')).click();
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 99.5'), {
      timeoutMsg: 'the remembered centre frequency was not restored',
    });
    await waitForState('Connected');
    expect(await captureMode()).toBe('single');

    // Continuous is saved too: it is shown again after another restart.
    await chooseMode('continuous');
    await browser.reloadSession();
    await waitForAppReady();
    await ensureDisconnected();
    expect(await captureMode()).toBe('continuous');
    await openSourceMenu();
    await selectSource(await simulatorEntryId());
    await waitForState('Connected');
    await ensureDisconnected();
  });
});
