import { $, browser, expect } from '@wdio/globals';

import {
  analyzerAtLaunch,
  byTestId,
  captureMode,
  chooseMode,
  closeSourceMenu,
  ensureDisconnected,
  entryByName,
  fillDialog,
  openEditDialog,
  openSourceMenu,
  clickRowAction,
  runSimulator,
  selectSource,
  sessionState,
  setInput,
  sourceButtonText,
  statusBarText,
  textOf,
  waitForAppReady,
  waitForGone,
  waitForState,
} from './helpers';

// Seeded (e2e/fixtures/seed/persistence/sources.json): one named simulator preset, "Bench FM setup".
// A named preset is listed under Your sources; the unnamed simulator is not (ADR 0017), and the
// fixed "Signal simulator" row of the menu is always offered.

/** The test id of the one remembered source that is not the analyzer (the simulator preset). */
async function simulatorEntryId(): Promise<string> {
  const entry = await simulatorEntry();
  return (await entry.getAttribute('data-testid')) ?? '';
}

/**
 * The simulator's remembered row. An attached analyzer is remembered too (launch auto-connect,
 * ADR 0014), so the row is the one that is not the SA430.
 */
async function simulatorEntry() {
  const entry = await $('[data-testid^="source-entry-"]:not([aria-label*="SA430"])');
  await entry.waitForExist({ timeoutMsg: 'the simulator preset is not listed' });
  return entry;
}

describe('Remembered sources and preferences', () => {
  it('remembers the settings a source was last used with, and the fixed simulator row stays offered', async () => {
    await runSimulator();
    await setInput('input[aria-label="Center frequency"]', '99.5M');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 99.5'));
    await ensureDisconnected();
    await openSourceMenu();
    // The seeded preset is the remembered simulator: it is listed by its name, and the fixed row
    // is still there. The unnamed simulator is not listed under Your sources.
    expect(await textOf(simulatorEntry())).toContain('Bench FM setup');
    await expect(await byTestId('source-simulator')).toBeDisplayed();
    await expect(await entryByName('Signal simulator')).not.toBeExisting();
    await closeSourceMenu();
  });

  it('renames a remembered source through the Edit dialog', async () => {
    await openSourceMenu();
    const id = await simulatorEntryId();
    await openEditDialog(id);
    await fillDialog({ name: 'E2E FM setup' });
    await (await byTestId('add-source-save')).click();
    await waitForGone('add-source-dialog');
    // Saving returns to the menu with the renamed row.
    expect(await textOf(simulatorEntry())).toContain('E2E FM setup');
    await closeSourceMenu();
    await browser.waitUntil(async () => (await sourceButtonText()).includes('E2E FM setup'));
  });

  it('forgets a source and brings it back with Undo', async () => {
    await openSourceMenu();
    const id = (await simulatorEntryId()).replace('source-entry-', '');
    await clickRowAction(`source-entry-${id}`, 'source-forget');
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

    // The launch connects by itself (ADR 0014, 0017): an attached analyzer, else the remembered
    // simulator preset with its settings. Either way the selection is the one that was in use.
    // The preset is then connected by hand below if it is not connected yet.
    if (await analyzerAtLaunch()) {
      expect(await sourceButtonText()).toContain('SA430');
      await ensureDisconnected();
    } else {
      expect(await sourceButtonText()).toContain('E2E FM setup');
      expect(await sessionState()).toBe('Connected');
      await ensureDisconnected();
    }
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
