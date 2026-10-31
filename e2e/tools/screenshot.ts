import { resolve } from 'node:path';

import { $, browser } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  livenessKind,
  openEditDialog,
  openSourceMenu,
  runSimulator,
  setInput,
} from '../specs/helpers';

describe('documentation screenshot', () => {
  it('captures the main window with the simulator running', async () => {
    await browser.setWindowSize(1440, 900);
    await runSimulator();
    await $('summary=Source settings').click(); // collapse? it starts collapsed; keep layout stable
    await $('summary=Source settings').click();
    await $('#averaging').click();
    await setInput('#averaging', '4');
    await $('input[type="checkbox"] + .swatch.max-hold').click();
    await (await byTestId('peak-search')).waitForEnabled();
    await (await byTestId('peak-search')).click();
    // Let the waterfall fill and the averages settle.
    await browser.pause(9000);
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    await browser.saveScreenshot(resolve(import.meta.dirname, '../../docs/images/main-window.png'));
  });

  // The menu and dialog are shown over the running simulator, from the seeded sources.
  it('captures the source menu', async () => {
    await openSourceMenu();
    await browser.pause(800); // the "no new devices" line and the scan settle
    // No row is hovered or focused, so the picture shows the resting menu.
    await browser.execute(() => (document.activeElement as HTMLElement | null)?.blur());
    await (await $('.brand')).moveTo();
    await browser.saveScreenshot(resolve(import.meta.dirname, '../../docs/images/source-menu.png'));
    await closeSourceMenu();
  });

  it('captures the Edit source dialog', async () => {
    await openEditDialog('source-entry-doc-sa430');
    await browser.pause(300);
    await browser.saveScreenshot(resolve(import.meta.dirname, '../../docs/images/edit-source.png'));
    await (await byTestId('add-source-cancel')).click();
  });
});
