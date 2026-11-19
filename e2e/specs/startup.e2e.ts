import { browser, expect } from '@wdio/globals';

import {
  analyzerAtLaunch,
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  livenessKind,
  openSourceMenu,
  runSimulator,
  sessionState,
  sourceButtonText,
  textOf,
  waitForAppReady,
} from './helpers';

/**
 * Start-up (ADR 0017): a source is always selected once the backend has answered. With no analyzer
 * attached the app connects the Signal simulator by itself and selects it; the source button reads
 * "Loading…" until the first status arrives, never "Choose a source".
 *
 * This spec does not seed a configuration: each spec file starts with nothing remembered, so the
 * launch is a first launch. The no-device launch needs no analyzer plugged in (docs/testing.md);
 * on a machine with one, the launch connects the analyzer instead and that test is pending.
 */
describe('Start-up', () => {
  it('starts with the simulator selected and connected, not acquiring, when no analyzer is attached', async function () {
    if (await analyzerAtLaunch()) this.skip();
    expect(await sourceButtonText()).toBe('Source: Signal simulator, Connected');
    expect(await sessionState()).toBe('Connected');
    expect(await livenessKind()).toBe('stopped');
    expect(await byTestId('acquire-button').getAttribute('data-state')).toBe('idle');
  });

  it('never shows "Choose a source" while starting: Loading… first, then the source name', async () => {
    // Records every value the source button's label takes from the first paint on. The observer is
    // installed as soon as the page exists, so a fast start may already be past "Loading…"; the
    // assertion is about what was recorded, and it is never the retired empty start.
    await browser.reloadSession();
    await browser.waitUntil(
      () =>
        browser.execute(() => {
          const w = window as unknown as { __sourceLabels?: string[] };
          if (!w.__sourceLabels) {
            w.__sourceLabels = [];
            const record = () => {
              const label = document
                .querySelector('[data-testid="source-button"]')
                ?.getAttribute('aria-label');
              if (label && w.__sourceLabels!.at(-1) !== label) w.__sourceLabels!.push(label);
            };
            new MutationObserver(record).observe(document.documentElement, {
              subtree: true,
              childList: true,
              attributes: true,
              attributeFilter: ['aria-label'],
            });
            record();
          }
          return true;
        }),
      { timeout: 15_000, interval: 50, timeoutMsg: 'the page did not start' },
    );
    await waitForAppReady();
    const labels = await browser.execute(
      () => (window as unknown as { __sourceLabels?: string[] }).__sourceLabels ?? [],
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).not.toContain('Choose a source');
    }
    // The first label recorded is either the loading text or an already loaded name, never empty.
    expect(labels[0]).toMatch(/^Source: (Loading…|Status unavailable|.+, [A-Za-z…]+)$/);
    // The final label is the source the app connected by itself (the simulator, or an analyzer).
    expect(await sessionState()).toBe('Connected');
  });

  it('shows the simulator in the fixed block of the menu, marked as the current source', async () => {
    await runSimulator();
    await openSourceMenu();
    const row = await byTestId('source-simulator');
    await expect(row).toBeDisplayed();
    expect(await row.getAttribute('aria-current')).toBe('true');
    expect(await textOf(row)).toContain('Acquiring');
    const group = await browser.execute(
      (el) => el.closest('[role="group"]')?.getAttribute('aria-label') ?? null,
      row,
    );
    expect(group).toBe('Add a source');
    await closeSourceMenu();
  });

  it('keeps the simulator selected and not connected after a Disconnect', async () => {
    await runSimulator();
    await ensureDisconnected();
    await openSourceMenu();
    const row = await byTestId('source-simulator');
    expect(await row.getAttribute('aria-current')).toBe('true');
    expect(await textOf(row)).toContain('Disconnected');
    await closeSourceMenu();
    expect(await sourceButtonText()).toBe('Source: Signal simulator, Disconnected');
  });
});
