// TEMPORARY QA reproducer (not part of the change). Measures layout of the toolbar and the menu.
import { browser } from '@wdio/globals';

import { byTestId, closeSourceMenu, entryByName, openSourceMenu, waitForAppReady } from './helpers';

const REAL = 'SA430 08FF41E50F8B3A34';

async function measure(label: string) {
  return browser.execute((lab: string) => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { l: +b.left.toFixed(3), r: +b.right.toFixed(3), t: +b.top.toFixed(3), b: +b.bottom.toFixed(3), w: +b.width.toFixed(3), h: +b.height.toFixed(3) };
    };
    const q = (s: string) => document.querySelector(s);
    const out: Record<string, unknown> = { label: lab, innerWidth: window.innerWidth };
    out.toolbar = r(q('.toolbar'));
    out.sourceControl = r(q('.source-control'));
    out.sourceButton = r(q('[data-testid="source-button"]'));
    out.acquire = r(q('[data-testid="acquire-button"]'));
    out.badgeSim = r(q('[data-testid="simulated-badge"]'));
    out.menu = r(q('[data-testid="source-menu"]'));
    const item = q('[data-testid="source-entry-' + 'x' + '"]');
    void item;
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="source-menu"] .source-item'));
    const real = items.find((i) => i.dataset['label'] === 'SA430 08FF41E50F8B3A34');
    if (real) {
      const row = real.closest('.source-row');
      out.realItem = r(real);
      out.realBorder = getComputedStyle(real).borderLeftWidth;
      out.realPadRight = getComputedStyle(real).paddingRight;
      out.realBadge = r(real.querySelector('.src-badge'));
      out.realRow = r(row);
      out.realActions = r(row?.querySelector('.source-actions') ?? null);
      out.realActionsCss = row?.querySelector('.source-actions')
        ? { right: getComputedStyle(row.querySelector('.source-actions')!).right, width: getComputedStyle(row.querySelector('.source-actions')!).width }
        : null;
    }
    return out;
  }, label);
}

describe('QA measure', () => {
  it('measures toolbar and menu', async () => {
    await waitForAppReady();
    const results: unknown[] = [];
    for (const w of [1180, 1024]) {
      await browser.setWindowSize(w, 820);
      await browser.pause(300);
      await closeSourceMenu();
      results.push(await measure(`${w}-closed`));
      await openSourceMenu();
      const id = (await (await entryByName(REAL)).getAttribute('data-testid'))!;
      await browser.execute((t: string) => (document.querySelector(`[data-testid="${t}"]`) as HTMLElement).focus(), id);
      results.push(await measure(`${w}-focused-real-immediate`));
      await browser.pause(200);
      results.push(await measure(`${w}-focused-real`));
      await (await byTestId(id)).moveTo();
      results.push(await measure(`${w}-hovered-real-immediate`));
      await browser.pause(400);
      results.push(await measure(`${w}-hovered-real-settled`));
      await closeSourceMenu();
    }
    console.log('QAMEASURE ' + JSON.stringify(results));
  });
});
