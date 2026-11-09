import { $, browser, expect } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  fillDialog,
  livenessKind,
  openEditDialog,
  openSourceMenu,
  revealRowActions,
  selectSource,
  shot,
  sourceButtonText,
  textOf,
  waitForAppReady,
  waitForState,
} from './helpers';

// Seeded sources (e2e/fixtures/seed/edit-source/sources.json): two simulator presets.
const SIM = 'source-entry-edit-sim';
const SPARE = 'source-entry-edit-spare';

async function saveDialog() {
  await (await byTestId('add-source-save')).click();
  await byTestId('add-source-dialog').waitForExist({ reverse: true });
}

describe('Edit source', () => {
  it('renames through the pencil button, and the new name survives a restart', async () => {
    await openEditDialog(SIM);
    await expect($('.source-dialog h2')).toHaveText('Edit source');
    await expect(await byTestId('add-source-name')).toHaveValue('Bench simulator');
    await expect(await byTestId('add-source-driver')).toBeDisabled();
    await fillDialog({ name: 'Renamed bench sim' });
    await saveDialog();
    expect(await textOf(byTestId(SIM))).toContain('Renamed bench sim');
    await closeSourceMenu();

    await browser.reloadSession();
    await waitForAppReady();
    await openSourceMenu();
    expect(await textOf(byTestId(SIM))).toContain('Renamed bench sim');
    await closeSourceMenu();
  });

  it('opens with F2 on the focused row', async () => {
    await openSourceMenu();
    await browser.execute((id) => {
      (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).focus();
    }, SIM);
    await browser.keys(['F2']);
    await byTestId('add-source-dialog').waitForDisplayed();
    await expect(await byTestId('add-source-name')).toHaveValue('Renamed bench sim');
    await browser.keys(['Escape']);
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
  });

  it('forgets from the dialog and brings the source back with Undo', async () => {
    await openEditDialog(SPARE);
    await (await byTestId('edit-source-forget')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    await expect(await byTestId(SPARE)).not.toBeExisting();
    await expect(await byTestId('source-forgot-toast')).toBeDisplayed();
    await (await byTestId('source-undo')).click();
    await expect(await byTestId(SPARE)).toBeExisting();
    expect(await textOf(byTestId(SPARE))).toContain('Spare simulator');
    await closeSourceMenu();
  });

  it('while connected: connection settings are locked, the name applies at once and the session keeps running', async () => {
    await selectSource(SIM);
    await waitForState('Connected');
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');

    await openEditDialog(SIM);
    await expect(await byTestId('add-source-driver')).toBeDisabled();
    await expect($('.source-dialog .dlg-note.info')).toHaveText(
      expect.stringContaining('This source is connected'),
    );
    await expect(await byTestId('add-source-test')).not.toBeExisting();
    await shot('edit-connected-lock-{w}-sim');
    await fillDialog({ name: 'Live renamed' });
    await saveDialog();

    await browser.waitUntil(async () => (await sourceButtonText()).includes('Live renamed'), {
      timeoutMsg: 'the toolbar button did not take the new name',
    });
    await expect(await byTestId('session-state')).toHaveText('Acquiring');
    expect(await livenessKind()).toBe('live');
    await closeSourceMenu();
    await ensureDisconnected();
  });
});
