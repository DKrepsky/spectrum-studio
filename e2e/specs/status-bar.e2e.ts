/**
 * Status bar (DESIGN.md 3.4, F0): whole items are removed in the decided order, and Center, Span,
 * Unit and Uncalibrated are never removed, at every supported width. The real fonts and layout are
 * measured here; the unit tests cover the same rule with a stubbed measure. Screenshots go to
 * `SPECTRUM_E2E_SHOTS` or `e2e/logs/visual`.
 */
import { browser } from '@wdio/globals';

import {
  byTestId,
  ensureDisconnected,
  livenessKind,
  runSimulator,
  sessionState,
  shot,
  statusBarText,
  waitForLaunchSettled,
} from './helpers';

const HEIGHT = 900;
/** Window widths of DESIGN.md 3.2: the minimum (C), the narrow edges and the default (A). */
const WIDTHS = [1440, 1257, 1180, 1024];
/** The removal order (DESIGN.md 3.4): the first item listed goes first. */
const DROP_ORDER = ['frame', 'rate', 'noise-floor', 'fft', 'avg', 'rbw'];
const PINNED = ['center', 'span', 'unit', 'uncalibrated'];

interface BarState {
  ids: string[];
  stripRight: number;
  overflow: number;
  unitRight: number | null;
  uncalibratedRight: number | null;
  text: string;
}

async function barState(): Promise<BarState> {
  return browser.execute(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="status-bar"]')!;
    const strip = bar.querySelector<HTMLElement>('.ui-status-strip')!;
    const right = (id: string) =>
      strip.querySelector<HTMLElement>(`[data-item-id="${id}"]`)?.getBoundingClientRect().right ??
      null;
    return {
      ids: [...strip.querySelectorAll('[data-item-id]')].map(
        (el) => el.getAttribute('data-item-id') ?? '',
      ),
      stripRight: strip.getBoundingClientRect().right,
      overflow: strip.scrollWidth - strip.clientWidth,
      unitRight: right('unit'),
      uncalibratedRight: right('uncalibrated'),
      text: bar.textContent ?? '',
    };
  });
}

/** Throws with a message when the condition does not hold (wdio expect takes no message). */
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function resize(width: number): Promise<number> {
  await browser.setWindowSize(width, HEIGHT);
  await browser.waitUntil(async () => (await barState()).overflow <= 1, {
    timeout: 5_000,
    timeoutMsg: `the status bar still overflows at ${width}px`,
  });
  return browser.execute(() => window.innerWidth);
}

describe('Status bar keeps the unit and the calibration state (F0)', () => {
  before(async () => {
    await waitForLaunchSettled();
    await ensureDisconnected();
    await runSimulator();
    // The bar shows a frame's items, not the no-data sentence: wait for them.
    await browser.waitUntil(async () => (await barState()).ids.includes('center'), {
      timeout: 10_000,
      timeoutMsg: 'the status bar never showed a frame',
    });
  });

  after(async () => {
    await browser.setWindowSize(1440, HEIGHT);
  });

  for (const width of WIDTHS) {
    it(`shows Unit and Uncalibrated, and removes whole items in order, at ${width}px`, async () => {
      const real = await resize(width);
      const bar = await barState();
      const context = `${await sessionState()} / ${await livenessKind()} / "${bar.text}"`;
      for (const id of PINNED) {
        check(bar.ids.includes(id), `${id} is missing at ${real}px (${context})`);
      }
      check(
        bar.uncalibratedRight !== null && bar.uncalibratedRight <= bar.stripRight + 0.5,
        `Uncalibrated is clipped at ${real}px (right ${bar.uncalibratedRight} > ${bar.stripRight})`,
      );
      check(
        bar.unitRight !== null && bar.unitRight <= bar.stripRight + 0.5,
        `Unit is clipped at ${real}px`,
      );
      check(bar.text.includes('Uncalibrated'), `no Uncalibrated text at ${real}px`);
      check(bar.text.includes('Unit dBFS'), `no Unit text at ${real}px`);

      const removed = DROP_ORDER.filter((id) => !bar.ids.includes(id));
      check(
        JSON.stringify(removed) === JSON.stringify(DROP_ORDER.slice(0, removed.length)),
        `items removed out of order at ${real}px: ${removed.join(', ')}`,
      );
      if (real === 1440) check(removed.length === 0, `items removed at 1440px: ${removed}`);
      await shot(`status-bar-{w}-connected`);
    });
  }

  it('status bar shows Uncalibrated at 1024px with an unlabeled source unit', async () => {
    await resize(1024);
    // The simulator reports dBFS: relative, never calibrated, so the bar must say so.
    const text = await statusBarText();
    check(text.includes('Uncalibrated'), `Uncalibrated is not shown at 1024px: ${text}`);
    check(await (await byTestId('status-bar')).isDisplayed(), 'the status bar is not displayed');
  });
});
