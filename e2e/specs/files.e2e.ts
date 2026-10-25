import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { $, $$, browser, expect } from '@wdio/globals';

import {
  byTestId,
  ensureDisconnected,
  livenessKind,
  setInput,
  statusBarText,
  waitForState,
} from './helpers';

const dir = mkdtempSync(join(tmpdir(), 'spectrum-studio-files-'));

/**
 * SigMF recording: complex tone at +100 kHz, amplitude 0.5 (−6.02 dBFS), centre 145 MHz, plus
 * a little noise as in any real recording.
 */
function writeSigmf(): string {
  const fs = 1_000_000;
  const n = 300_000;
  const data = Buffer.alloc(n * 8);
  let seed = 1;
  const noise = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return (seed / 2 ** 31 - 0.5) * 1e-3;
  };
  for (let i = 0; i < n; i++) {
    const ph = (2 * Math.PI * 100_000 * i) / fs;
    data.writeFloatLE(0.5 * Math.cos(ph) + noise(), i * 8);
    data.writeFloatLE(0.5 * Math.sin(ph) + noise(), i * 8 + 4);
  }
  writeFileSync(join(dir, 'tone.sigmf-data'), data);
  writeFileSync(
    join(dir, 'tone.sigmf-meta'),
    JSON.stringify({
      global: { 'core:datatype': 'cf32_le', 'core:sample_rate': fs, 'core:version': '1.0.0' },
      captures: [{ 'core:sample_start': 0, 'core:frequency': 145e6 }],
      annotations: [],
    }),
  );
  return join(dir, 'tone.sigmf-meta');
}

function writeTrace(): string {
  const rows = ['frequency_hz,level_dBm'];
  for (let i = 0; i < 101; i++) rows.push(`${2.4e9 + i * 1e5},${i === 50 ? -25 : -90}`);
  writeFileSync(join(dir, 'trace.csv'), rows.join('\n'));
  return join(dir, 'trace.csv');
}

async function connectFile(driverId: string, path: string) {
  await (await byTestId('sources-button')).click();
  await (await byTestId(`driver-${driverId}`)).click();
  await setInput(`#conn-${driverId}-path`, path);
  await (await byTestId('manager-connect')).click();
  await waitForState('Connected');
}

describe('Recordings', () => {
  it('replays a SigMF IQ recording through the FFT pipeline', async () => {
    await connectFile('iq-file', writeSigmf());
    await expect(await byTestId('simulated-badge')).not.toBeExisting();
    await expect($('input[aria-label="Center frequency"]')).toBeDisabled();
    await (await byTestId('run-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live');
    await browser.waitUntil(async () => (await statusBarText()).includes('Center 145.0000'));
    const peak = (await $$('[data-testid="peak-table"] tbody tr'))[0]!;
    await expect(peak).toHaveText(expect.stringMatching(/145\.10+ MHz\s*-6\.0 dBFS/));
    await ensureDisconnected();
  });

  it('shows a CSV trace as supplied, in its own unit, and marks it as not live', async () => {
    await connectFile('trace-csv', writeTrace());
    await expect($('#fft-size')).toBeDisabled();
    await (await byTestId('run-button')).click();
    await browser.waitUntil(async () => (await statusBarText()).includes('dBm'));
    await waitForState('Connected');
    await expect(await byTestId('session-notice')).toHaveText(
      expect.stringContaining('end of the recording'),
    );
    expect(await livenessKind()).toBe('stopped');
    const status = await statusBarText();
    expect(status).toContain('Points 101');
    expect(status).not.toContain('Uncalibrated');
    await ensureDisconnected();
  });

  it('explains why an invalid file cannot be opened', async () => {
    writeFileSync(join(dir, 'uneven.csv'), '1,0\n2,0\n10,0\n');
    await (await byTestId('sources-button')).click();
    await (await byTestId('driver-trace-csv')).click();
    await setInput('#conn-trace-csv-path', join(dir, 'uneven.csv'));
    await (await byTestId('manager-connect')).click();
    await expect(await byTestId('session-notice')).toHaveText(
      expect.stringContaining('evenly spaced'),
    );
    await expect(await byTestId('session-state')).toHaveText('Disconnected');
    await browser.keys(['Escape']);
  });
});
