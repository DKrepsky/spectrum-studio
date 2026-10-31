/**
 * End-to-end tests against the real application binary, driven through WebKitWebDriver via
 * tauri-driver. See docs/testing.md for prerequisites.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browser } from '@wdio/globals';

const root = resolve(import.meta.dirname, '..');
const application =
  process.env.SPECTRUM_STUDIO_BINARY ?? join(root, 'target', 'debug', 'spectrum-studio');
const tauriDriverPath =
  process.env.TAURI_DRIVER ?? join(homedir(), '.cargo', 'bin', 'tauri-driver');

let tauriDriver: ChildProcess | undefined;
// Isolated configuration directory per spec file (worker), so tests never touch the user's
// preferences; it survives `browser.reloadSession()` to test persistence across restarts.
let configHome: string | undefined;

/**
 * Copies `e2e/fixtures/seed/<spec basename>/*` into the app's config directory (only when the
 * directory is first created, so restarts within a spec keep what the app wrote). `{{REPO}}` in a
 * seed file is replaced with the repository root, so seeds can point at real fixtures.
 */
function seedConfig(configHome: string, spec: string | undefined) {
  if (!spec) return;
  const path = spec.startsWith('file:') ? fileURLToPath(spec) : spec;
  const name = basename(path).replace(/(\.e2e)?\.ts$/, '');
  const seed = join(root, 'e2e', 'fixtures', 'seed', name);
  if (!existsSync(seed)) return;
  const target = join(configHome, 'io.github.spectrumstudio');
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(seed)) {
    const text = readFileSync(join(seed, file), 'utf8').replaceAll('{{REPO}}', root);
    writeFileSync(join(target, file), text);
  }
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: 4444,
  specs: ['./specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      // @ts-expect-error tauri-driver specific capability
      'tauri:options': { application },
    },
  ],
  logLevel: 'warn',
  waitforTimeout: 10_000,
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 90_000 },
  // Every spec (and every restart within a spec) starts once the UI has loaded backend state.
  before: async () => {
    const { waitForAppReady } = await import('./specs/helpers');
    await waitForAppReady();
  },

  beforeSession: (_config, _capabilities, specs) => {
    if (!configHome) {
      const dir = mkdtempSync(join(tmpdir(), 'spectrum-studio-e2e-'));
      configHome = dir;
      // Lets specs inspect the files the app writes (see migration.e2e.ts).
      process.env.SPECTRUM_E2E_APP_CONFIG = join(dir, 'io.github.spectrumstudio');
      process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
      seedConfig(dir, specs[0]);
    }
    tauriDriver = spawn(tauriDriverPath, [], {
      stdio: [null, process.stdout, process.stderr],
      env: { ...process.env, XDG_CONFIG_HOME: configHome },
    });
  },
  afterTest: async (test, _context, { passed }) => {
    if (passed) return;
    // Keep a screenshot of every failure for diagnosis (e2e/logs is git-ignored).
    const dir = join(root, 'e2e', 'logs');
    mkdirSync(dir, { recursive: true });
    const name = `${test.parent} ${test.title}`.replace(/[^a-z0-9]+/gi, '-').slice(0, 120);
    await browser.saveScreenshot(join(dir, `${name}.png`));
  },
  afterSession: async () => {
    // Wait for the driver to exit so the next spec file can bind the same port.
    const driver = tauriDriver;
    if (driver && driver.exitCode === null) {
      await new Promise((resolve) => {
        driver.once('exit', resolve);
        driver.kill();
      });
    }
  },
};
