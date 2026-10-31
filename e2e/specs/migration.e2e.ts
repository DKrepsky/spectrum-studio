import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { browser, expect } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  openSourceMenu,
  selectSource,
  statusBarText,
  textOf,
  waitForState,
} from './helpers';

// Seeded with a version 1 sources.json (e2e/fixtures/seed/migration): two usable entries, one
// of an unknown driver ("ghost") and one of a planned driver ("soapysdr").
const sourcesFile = () => join(process.env.SPECTRUM_E2E_APP_CONFIG!, 'sources.json');

describe('Upgrading a version 1 sources file', () => {
  it('lists the usable saved sources and hides unknown and planned ones', async () => {
    await openSourceMenu();
    expect(await textOf(byTestId('source-entry-old-sim'))).toContain('Old simulator setup');
    expect(await textOf(byTestId('source-entry-old-trace'))).toContain('Old CSV trace');
    await expect(await byTestId('source-entry-old-ghost')).not.toBeExisting();
    await expect(await byTestId('source-entry-old-soapy')).not.toBeExisting();
    await closeSourceMenu();
  });

  it('connects a migrated entry with its saved settings', async () => {
    await selectSource('source-entry-old-sim');
    await waitForState('Connected');
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 88.0'), {
      timeoutMsg: 'the migrated centre frequency was not applied',
    });
    await ensureDisconnected();
  });

  it('rewrites the file as version 3, backs the old one up and keeps the hidden entries untouched', async () => {
    let file: { version: number; sources: { id: string; lastUsedMs: number }[] };
    await browser.waitUntil(() => {
      file = JSON.parse(readFileSync(sourcesFile(), 'utf8'));
      return file.version === 3;
    });
    const ids = file!.sources.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['old-sim', 'old-trace', 'old-ghost', 'old-soapy']));
    const backups = readdirSync(process.env.SPECTRUM_E2E_APP_CONFIG!).filter((f) =>
      /^sources\.pre-v3-\d+\.json$/.test(f),
    );
    expect(backups).toHaveLength(1);
    expect(
      JSON.parse(readFileSync(join(process.env.SPECTRUM_E2E_APP_CONFIG!, backups[0]!), 'utf8'))
        .version,
    ).toBe(1);
    const sim = file!.sources.find((s) => s.id === 'old-sim')!;
    expect(sim.lastUsedMs).toBeGreaterThan(3000);
  });
});
