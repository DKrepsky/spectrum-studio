import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { $, $$, browser, expect } from '@wdio/globals';
import type { ChainablePromiseElement } from 'webdriverio';

export const byTestId = (id: string) => $(`[data-testid="${id}"]`);

/**
 * Waits for the failure banner of a failed pick and returns it. The backend reports a failed connect
 * twice (session notice and command error); the UI must show exactly one banner.
 */
export async function failureBanner() {
  const selector = '[data-testid="session-notice"], [data-testid="command-error"]';
  await browser.waitUntil(async () => (await $$(selector).length) > 0, {
    timeoutMsg: 'no failure banner appeared',
  });
  const banners = await $$(selector);
  if (banners.length !== 1) {
    throw new Error(`expected exactly one failure banner, found ${banners.length}`);
  }
  return banners[0];
}

const STATE_SUFFIX = /, (Disconnected|Connecting…|Connected|Acquiring|Disconnecting…)$/;

/**
 * The backend state as the UI shows it: the suffix of the source button's accessible name
 * ("Source: <name>, <state>"). Without a chosen source there is no state to show: Disconnected.
 */
export async function sessionState(): Promise<string> {
  return (await sourceButtonText()).match(STATE_SUFFIX)?.[1] ?? 'Disconnected';
}

export async function waitForState(text: string, timeout = 15_000) {
  await browser.waitUntil(async () => (await sessionState()) === text, {
    timeout,
    timeoutMsg: `session state did not become "${text}" (is "${await sessionState()}")`,
  });
}

export async function livenessKind(): Promise<string | null> {
  return (await byTestId('plot-liveness')).getAttribute('data-kind');
}

export async function statusBarText(): Promise<string> {
  return (await byTestId('status-bar')).getText();
}

/** Opens the source menu (no-op when it is already open). */
export async function openSourceMenu() {
  if (!(await byTestId('source-menu').isExisting())) {
    await (await byTestId('source-button')).click();
  }
  await byTestId('source-menu').waitForExist({ timeoutMsg: 'the source menu did not open' });
}

/** Closes the source menu if it is open. */
export async function closeSourceMenu() {
  if (await byTestId('source-menu').isExisting()) {
    await browser.keys(['Escape']);
    try {
      await byTestId('source-menu').waitForExist({ reverse: true, timeout: 1500 });
    } catch {
      // Escape is handled inside the menu; after Undo focus is on the page body, so close it
      // with the button instead.
      await (await byTestId('source-button')).click();
      await byTestId('source-menu').waitForExist({ reverse: true });
    }
  }
}

/** Picks a menu item by test id (picking connects). The menu closes by itself afterwards. */
export async function selectSource(testId: string) {
  await openSourceMenu();
  const item = await byTestId(testId);
  await item.waitForExist({ timeoutMsg: `${testId} is not in the source menu` });
  await item.click();
}

/** The row of a remembered source in the menu (its rename and forget buttons live inside). */
export async function sourceRow(entryId: string) {
  return (await byTestId(`source-entry-${entryId}`)).parentElement();
}

/**
 * Text of an element including parts WebKitWebDriver's `getText` skips: the source names are
 * `overflow: hidden` ellipsis spans, which it reports as empty.
 */
export async function textOf(
  element: ChainablePromiseElement | WebdriverIO.Element | Promise<WebdriverIO.Element>,
) {
  return String((await (await element).getProperty('textContent')) ?? '');
}

/** The source button's accessible name: "Source: <name>, <state>" (or "Choose a source"). */
export async function sourceButtonText(): Promise<string> {
  return (await byTestId('source-button')).getAttribute('aria-label').then((v) => v ?? '');
}

/** The Play/Pause toggle: `idle` (Play, "Start acquisition") or `acquiring` (Pause). */
export async function acquireState(): Promise<string | null> {
  return (await byTestId('acquire-button')).getAttribute('data-state');
}

/**
 * Picks the Signal simulator (when not connected yet) and presses Play: the new first-run journey.
 * Once the simulator has been remembered it is listed under Your sources instead of the fixed
 * "Signal simulator" row, so either is accepted.
 */
export async function runSimulator() {
  if ((await sessionState()) === 'Disconnected') {
    await openSourceMenu();
    const fixed = await byTestId('source-simulator');
    if (await fixed.isExisting()) {
      await fixed.click();
    } else {
      const own = await $('[data-testid^="source-entry-"][data-label*="imulator"]');
      await own.click();
    }
    await waitForState('Connected');
  }
  await (await byTestId('acquire-button')).click();
  await waitForState('Acquiring');
  await browser.waitUntil(async () => (await livenessKind()) === 'live', {
    timeoutMsg: 'plot did not become live',
  });
}

/** Returns to a disconnected state, whatever the current state is. */
export async function ensureDisconnected() {
  if ((await sessionState()) !== 'Disconnected') {
    await openSourceMenu();
    await (await byTestId('source-disconnect')).click();
    await waitForState('Disconnected');
  }
  await closeSourceMenu();
  await waitForState('Disconnected');
}

export async function setInput(selector: string, value: string) {
  const input = await $(selector);
  await input.click();
  await browser.keys(['Control', 'a']);
  await browser.keys(['Backspace']);
  await input.addValue(value);
  await browser.keys(['Enter']);
}

/** Waits until the UI has loaded the backend state (the source button is rendered). */
export async function waitForAppReady() {
  await byTestId('source-button').waitForExist({
    timeoutMsg: 'the application did not finish loading',
  });
  await browser.waitUntil(async () => (await sourceButtonText()).length > 0);
}

// ---- Add / Edit source dialog -----------------------------------------------------------------

const DIALOG = '[data-testid="add-source-dialog"]';

/** The text input of the dialog's (single) connection field, e.g. the SA430 serial port. */
export const PORT_INPUT = `${DIALOG} .dialog-params input[type="text"]`;

/** Opens the menu and chooses `Add source…`; resolves once the dialog is shown. */
export async function openAddSourceDialog() {
  await openSourceMenu();
  await (await byTestId('source-add')).click();
  await byTestId('add-source-dialog').waitForDisplayed({
    timeoutMsg: 'the Add dialog did not open',
  });
}

/**
 * Makes the hover actions of a row clickable (they are transparent and non-interactive until the
 * row is hovered or one of them has focus). Hovers first; focusing the button is the fallback.
 */
export async function revealRowActions(entryTestId: string) {
  const row = await sourceRow(entryTestId.replace(/^source-entry-/, ''));
  const edit = await row.$('[data-testid="source-edit"]');
  await (await byTestId(entryTestId)).moveTo();
  if (!(await edit.isDisplayed())) {
    await browser.execute((id) => {
      (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).focus();
    }, entryTestId);
  }
  await edit.waitForDisplayed({ timeoutMsg: 'the row actions did not appear' });
  return row;
}

/** Opens the menu and the Edit dialog of one remembered row, via its `✎` button. */
export async function openEditDialog(entryTestId: string) {
  await openSourceMenu();
  const row = await revealRowActions(entryTestId);
  await row.$('[data-testid="source-edit"]').click();
  await byTestId('add-source-dialog').waitForDisplayed({
    timeoutMsg: 'the Edit dialog did not open',
  });
}

async function typeInto(selector: string, value: string) {
  const input = await $(selector);
  await input.click();
  await browser.keys(['Control', 'a']);
  await browser.keys(['Backspace']);
  if (value !== '') await input.addValue(value);
}

/** Types into the dialog's name and/or port field (each only when given). */
export async function fillDialog(fields: { name?: string; port?: string }) {
  if (fields.name !== undefined) await typeInto('[data-testid="add-source-name"]', fields.name);
  if (fields.port !== undefined) await typeInto(PORT_INPUT, fields.port);
}

/** Text of the dialog's test result box (idle, running, ok or failed). */
export async function testResultText(): Promise<string> {
  return textOf(byTestId('add-source-test-result'));
}

/** Waits until the test has finished (the result box shows a verdict) and returns its text. */
export async function runTestConnection(): Promise<string> {
  await (await byTestId('add-source-test')).click();
  await browser.waitUntil(async () => /^\s*[✓✕]/.test(await testResultText()), {
    timeout: 20_000,
    timeoutMsg: `Test connection did not finish (shows "${await testResultText()}")`,
  });
  return testResultText();
}

/** Looks a menu row up by the name it shows. */
export async function entryByName(name: string) {
  return $(`[data-testid^="source-entry-"][data-label="${name}"]`);
}

// ---- Layout measurements and screenshots --------------------------------------------------------

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** Bounding box (real pixels) of the first element matching a CSS selector, or null. */
export async function boxOf(selector: string): Promise<Box | null> {
  return browser.execute((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  }, selector);
}

/** Bounding box of a menu/test-id element. */
export const rowRect = (testId: string) => boxOf(`[data-testid="${testId}"]`);

/**
 * Elements under `rootSelector` whose content is wider than their box (`scrollWidth >
 * clientWidth + 1`), without `data-truncated`, that are not deliberately ellipsised with the full
 * text in a `title`/`aria-label`. Returns descriptions; an empty list means no overflow.
 */
export async function findOverflow(rootSelector: string): Promise<string[]> {
  return browser.execute((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [`${sel}: not found`];
    const found: string[] = [];
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
      const e = el as HTMLElement;
      if (e.scrollWidth <= e.clientWidth + 1 || e.clientWidth === 0) continue;
      if (e.hasAttribute('data-truncated')) continue;
      const cs = getComputedStyle(e);
      const clipsDeliberately = cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible';
      const owner = e.closest('[title],[aria-label]');
      const text = (e.textContent ?? '').trim();
      const explained =
        owner != null &&
        (owner.getAttribute('title') ?? owner.getAttribute('aria-label') ?? '').includes(text);
      if (clipsDeliberately && explained) continue;
      found.push(
        `${e.tagName.toLowerCase()}.${e.className} "${text.slice(0, 40)}" scroll ${e.scrollWidth} > client ${e.clientWidth}`,
      );
    }
    return found;
  }, rootSelector);
}

/** Asserts that nothing under the selector overflows its box (see `findOverflow`). */
export async function assertNoOverflow(rootSelector: string) {
  expect(await findOverflow(rootSelector)).toEqual([]);
}

const SHOT_DIR = process.env.SPECTRUM_E2E_SHOTS ?? resolve(import.meta.dirname, '../logs/visual');

/**
 * Saves a screenshot of the window to `e2e/logs/visual/<name>.png` (or `SPECTRUM_E2E_SHOTS`);
 * `{w}` in the name is replaced by the real viewport width.
 */
export async function shot(name: string): Promise<string> {
  mkdirSync(SHOT_DIR, { recursive: true });
  const width = await browser.execute(() => window.innerWidth);
  const path = join(SHOT_DIR, `${name.replace('{w}', String(width))}.png`);
  await browser.saveScreenshot(path);
  return path;
}
