import { $, browser, expect } from '@wdio/globals';

export const byTestId = (id: string) => $(`[data-testid="${id}"]`);

export async function sessionState(): Promise<string> {
  return (await byTestId('session-state')).getText();
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

/** Starts the simulator from a disconnected state using the toolbar Run button. */
export async function runSimulator() {
  await (await byTestId('run-button')).click();
  await waitForState('Acquiring');
  await browser.waitUntil(async () => (await livenessKind()) === 'live', {
    timeoutMsg: 'plot did not become live',
  });
}

/** Returns to a disconnected state, whatever the current state is. */
export async function ensureDisconnected() {
  const disconnect = await byTestId('disconnect-button');
  if (await disconnect.isExisting()) {
    await disconnect.click();
    await waitForState('Disconnected');
  }
  await expect(await byTestId('session-state')).toHaveText('Disconnected');
}

export async function setInput(selector: string, value: string) {
  const input = await $(selector);
  await input.click();
  await browser.keys(['Control', 'a']);
  await browser.keys(['Backspace']);
  await input.addValue(value);
  await browser.keys(['Enter']);
}

/** Waits until the UI has loaded the backend state (drivers and status). */
export async function waitForAppReady() {
  await browser.waitUntil(
    async () => (await byTestId('source-select').getText()).includes('Signal simulator'),
    { timeoutMsg: 'the application did not finish loading' },
  );
}
