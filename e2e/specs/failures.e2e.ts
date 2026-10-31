import { $, $$, browser, expect } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  livenessKind,
  openSourceMenu,
  selectSource,
  setInput,
  sourceRow,
  textOf,
  waitForState,
  failureBanner,
} from './helpers';

// Seeded sources (e2e/fixtures/seed/failures/sources.json): a plain simulator, a simulator whose
// connection always fails, a CSV file with uneven spacing and an IQ recording that does not exist.
describe('Failure handling', () => {
  it('reports a failed pick, marks the entry Failed and stays disconnected', async () => {
    await selectSource('source-entry-seed-fail');
    const notice = await failureBanner();
    await notice.waitForDisplayed();
    await expect(notice).toHaveText(expect.stringContaining('refused the connection'));
    await expect(await byTestId('session-state')).toHaveText('Disconnected');

    await openSourceMenu();
    expect(await textOf(await sourceRow('seed-fail'))).toContain('Failed');
    await closeSourceMenu();
  });

  it('explains why an invalid file cannot be opened', async () => {
    await selectSource('source-entry-seed-uneven');
    await expect(await failureBanner()).toHaveText(expect.stringContaining('evenly spaced'));
    await expect(await byTestId('session-state')).toHaveText('Disconnected');
  });

  it('explains a recording that is missing', async () => {
    await selectSource('source-entry-seed-missing');
    await browser.waitUntil(
      async () => /missing\.sigmf-meta|No such file|not found/i.test(await commandError()),
      { timeoutMsg: 'no useful message for a missing file' },
    );
    await expect(await byTestId('session-state')).toHaveText('Disconnected');
  });

  it('detects device loss during acquisition and recovers with Reconnect', async () => {
    await selectSource('source-entry-seed-sim');
    await waitForState('Connected');
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await setSourceSettingsOpen(true);
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
    await setSourceSettingsOpen(false);
    await ensureDisconnected();
  });

  it('never offers planned integrations, which cannot be connected', async () => {
    await openSourceMenu();
    const menu = await byTestId('source-menu');
    const text = await textOf(menu);
    expect(text).not.toMatch(/soapy|tinysa|rtl_tcp|scpi/i);
    expect(await $$('[data-testid^="source-pick-"]')).toHaveLength(0);
    await closeSourceMenu();
    await expect(await $('[data-testid^="driver-"]')).not.toBeExisting();
  });
});

async function commandError(): Promise<string> {
  const els = await $$('[data-testid="session-notice"], [data-testid="command-error"]');
  return els.length ? els[0].getText() : '';
}

/** Opens or closes the collapsible Source settings; clicking blindly toggles it twice if a re-render raced. */
async function setSourceSettingsOpen(open: boolean) {
  const summary = await $('summary=Source settings');
  await browser.waitUntil(async () => {
    const isOpen = await browser.execute(
      (el) => (el.parentElement as HTMLDetailsElement).open,
      summary,
    );
    if (isOpen === open) return true;
    await summary.click();
    return false;
  });
}
