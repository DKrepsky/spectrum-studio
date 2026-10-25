import { resolve } from 'node:path';

import { $, browser } from '@wdio/globals';

import { byTestId, livenessKind, runSimulator, setInput } from '../specs/helpers';

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
});
