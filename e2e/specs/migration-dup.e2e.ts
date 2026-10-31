import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { $$, browser, expect } from '@wdio/globals';

import {
  closeSourceMenu,
  fillDialog,
  openEditDialog,
  openSourceMenu,
  byTestId,
  shot,
  textOf,
  waitForAppReady,
} from './helpers';

// Seeded with the two duplicated SA430 records the user's real sources.json contained (one with
// no port, one with /dev/ttyACM0), both labelled "SA430 08FF41E50F8B3A34". With the analyzer
// attached the merged row is present, without it the row reads "Not detected"; either way it is
// ONE row. The harness cannot unplug or move a device, so replug and other-port behaviour is
// covered by the Rust tests (identity resolution) and by hardware QA.
const configDir = () => process.env.SPECTRUM_E2E_APP_CONFIG!;
const NAME = 'SA430 08FF41E50F8B3A34';

const rows = () => $$('[data-testid^="source-entry-"]');

describe('Upgrading a store with duplicate SA430 records', () => {
  it('shows exactly one row for the device, keeping its name', async () => {
    await openSourceMenu();
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(await textOf(all[0]!)).toContain(NAME);
    await shot('migrated-menu-{w}-sa430');
    await closeSourceMenu();
  });

  it('wrote version 3 with one record and left a backup of the old file', async () => {
    const backups = readdirSync(configDir()).filter((f) => /^sources\.pre-v3-\d+\.json$/.test(f));
    expect(backups).toHaveLength(1);
    const old = JSON.parse(readFileSync(join(configDir(), backups[0]!), 'utf8'));
    expect(old.version).toBe(2);
    expect(old.sources).toHaveLength(2);

    const file = JSON.parse(readFileSync(join(configDir(), 'sources.json'), 'utf8'));
    expect(file.version).toBe(3);
    expect(file.sources).toHaveLength(1);
    expect(existsSync(join(configDir(), 'sources.json'))).toBe(true);
  });

  it('keeps one row after renaming it and restarting', async () => {
    await openSourceMenu();
    const id = (await (await rows())[0]!.getAttribute('data-testid'))!;
    await closeSourceMenu();
    await openEditDialog(id);
    await fillDialog({ name: 'Bench SA430' });
    await (await byTestId('add-source-save')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    await closeSourceMenu();

    await browser.reloadSession();
    await waitForAppReady();
    await openSourceMenu();
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(await textOf(all[0]!)).toContain('Bench SA430');
    await closeSourceMenu();
    // Restarting must not create further backups.
    const backups = readdirSync(configDir()).filter((f) => f.startsWith('sources.pre-v3-'));
    expect(backups).toHaveLength(1);
  });
});
