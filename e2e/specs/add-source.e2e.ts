import { $, $$, browser, expect } from '@wdio/globals';

import {
  sessionState,
  byTestId,
  closeSourceMenu,
  entryByName,
  fillDialog,
  openAddSourceDialog,
  openSourceMenu,
  revealRowActions,
  runTestConnection,
  sourceButtonText,
  shot,
  sourceRow,
  testResultText,
  textOf,
  waitForState,
  failureBanner,
} from './helpers';

// No seed: this is the first launch (nothing remembered). The untestable port is a path that
// is not a serial device, so the backend's own failure text is shown and nothing is connected.
const BAD_PORT = '/dev/spectrum-e2e-no-such-port';

const describeHardware = process.env.SPECTRUM_E2E_SA430 === '1' ? describe : describe.skip;

describe('Add source', () => {
  it('first launch: the menu offers the simulator and Add source, no scan button', async () => {
    expect(await sessionState()).toBe('Disconnected');
    await openSourceMenu();
    await expect(await byTestId('source-simulator')).toBeDisplayed();
    await expect(await byTestId('source-add')).toBeDisplayed();
    const text = await textOf(byTestId('source-menu'));
    expect(text).toContain('Detected devices');
    expect(text).not.toMatch(/scan\b(?!ning)/i);
    expect(text).not.toContain('Other sources');
    await shot('first-launch-menu-{w}-empty');
    await closeSourceMenu();
  });

  it('Cancel and Escape discard the dialog without remembering anything', async () => {
    await openAddSourceDialog();
    await fillDialog({ name: 'Discard me', port: BAD_PORT });
    await (await byTestId('add-source-cancel')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    await openSourceMenu();
    await expect(await entryByName('Discard me')).not.toBeExisting();
    await closeSourceMenu();

    await openAddSourceDialog();
    await fillDialog({ name: 'Discard me too' });
    await browser.keys(['Escape']);
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    await openSourceMenu();
    await expect(await entryByName('Discard me too')).not.toBeExisting();
    await closeSourceMenu();
  });

  it('Test connection shows the backend failure and the source can still be saved untested', async () => {
    await openAddSourceDialog();
    await expect(await byTestId('add-source-save')).toBeDisabled(); // no name yet
    await fillDialog({ name: 'Bench rig', port: BAD_PORT });
    expect(await testResultText()).toContain('Not tested');
    const text = await runTestConnection();
    expect(text).toContain('Test failed:');
    expect(text.length).toBeGreaterThan('✕ Test failed: '.length + 5);
    await expect($('.source-dialog .dlg-note')).toHaveText(
      expect.stringContaining('You can still save an untested source.'),
    );
    await shot('add-dialog-failed-{w}-badport');
    await expect(await byTestId('add-source-save')).toBeEnabled();
    await (await byTestId('add-source-save')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });

    // Saving remembers, it never connects.
    expect(await sessionState()).toBe('Disconnected');
    expect(await textOf(await entryByName('Bench rig'))).toContain('Bench rig');
    await expect(await byTestId('source-simulator')).toBeDisplayed();
    await closeSourceMenu();
  });

  it('picking the untested source fails with the backend message and a red cross row', async () => {
    await openSourceMenu();
    await (await entryByName('Bench rig')).click();
    const notice = await failureBanner();
    await notice.waitForDisplayed();
    expect((await notice.getText()).length).toBeGreaterThan(10);
    expect(await sessionState()).toBe('Disconnected');

    await openSourceMenu();
    const row = await entryByName('Bench rig');
    expect(await row.$('.src-dot').getAttribute('data-status')).toBe('failed');
    expect(await textOf(await sourceRow(await rowId(row)))).toContain('Failed');
    await shot('failed-row-{w}-untested');
    await closeSourceMenu();
  });

  it('rejects a duplicate name, case-insensitively', async () => {
    await openAddSourceDialog();
    await fillDialog({ name: 'bench RIG', port: BAD_PORT });
    await expect($('.source-dialog .err')).toHaveText('A source with this name already exists.');
    await expect(await byTestId('add-source-save')).toBeDisabled();
    await fillDialog({ name: 'Bench rig 2' });
    await expect(await byTestId('add-source-save')).toBeEnabled();
    await (await byTestId('add-source-cancel')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
  });

  it('forgetting the selected, not connected source clears the toolbar button (R2-3)', async () => {
    // "Bench rig" is still selected after its failed connect: the button shows it.
    expect(await sourceButtonText()).toContain('Bench rig');
    await openSourceMenu();
    const row = await entryByName('Bench rig');
    const id = await rowId(row);
    await revealRowActions(`source-entry-${id}`);
    await (await sourceRow(id)).$('[data-testid="source-forget"]').click();
    await expect(await byTestId('source-forgot-toast')).toBeDisplayed();
    await closeSourceMenu();
    expect(await sourceButtonText()).toBe('Source: Choose a source');
    expect(await sourceButtonText()).not.toContain('Bench rig');
    await expect(await byTestId('acquire-button')).toBeDisabled();
    expect(await sessionState()).toBe('Disconnected');
    await shot('forget-selected-{w}-cleared');
  });
});

async function rowId(row: WebdriverIO.Element): Promise<string> {
  return ((await row.getAttribute('data-testid')) ?? '').replace('source-entry-', '');
}

describeHardware('Add source with the real SA430', () => {
  it('saving the detected port WITHOUT Test still leaves ONE row for the device (R2-1)', async () => {
    await openSourceMenu();
    await $('[data-testid^="source-detected-sa430-"]').waitForExist({
      timeoutMsg: 'the SA430 was not detected',
    });
    await closeSourceMenu();
    await openAddSourceDialog();
    await fillDialog({ name: 'Untested Bench SA430', port: '/dev/ttyACM0' });
    await (await byTestId('add-source-save')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });

    await openSourceMenu();
    await browser.pause(3500); // two discovery polls
    const rows = await $$('[data-testid^="source-entry-"][data-label="Untested Bench SA430"]');
    expect(rows).toHaveLength(1);
    await expect(await $('[data-testid^="source-detected-sa430-"]')).not.toBeExisting();
    const saved = await rows[0]!.getAttribute('data-testid');
    await shot('menu-untested-save-{w}-sa430');
    // Back to a clean slate for the next test: forget it.
    const id = (saved ?? '').replace('source-entry-', '');
    await revealRowActions(`source-entry-${id}`);
    await (await sourceRow(id)).$('[data-testid="source-forget"]').click();
    await closeSourceMenu();
  });

  it('tests /dev/ttyACM0, shows the serial, and ends with ONE row for the device', async () => {
    await openAddSourceDialog();
    await fillDialog({ name: 'E2E Bench SA430', port: '/dev/ttyACM0' });
    const text = await runTestConnection();
    expect(text).toContain('Connection OK');
    expect(text).toMatch(/Serial number [0-9A-F]{8,}/);
    await shot('add-dialog-ok-{w}-sa430');
    await (await byTestId('add-source-save')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });

    // It is also detected, but the menu shows one row for the physical device.
    await browser.pause(1500); // let the discovery poll run
    const rows = await $$('[data-testid^="source-entry-"][data-label="E2E Bench SA430"]');
    expect(rows).toHaveLength(1);
    await expect(await $('[data-testid^="source-detected-sa430-"]')).not.toBeExisting();
    await closeSourceMenu();
    await waitForState('Disconnected');
  });
});
