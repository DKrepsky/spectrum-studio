/**
 * Visual guard: measures REAL pixels in the built app (WebKitGTK) so that layout regressions in
 * the source button, the menu rows and the Add/Edit dialog fail the suite, and saves screenshots
 * of the key states (`e2e/logs/visual/<state>-<width>-<data>.png`, or `SPECTRUM_E2E_SHOTS`).
 * jsdom cannot lay anything out, so this is the only place where the fixed 64px badge column,
 * the constant name column and "nothing overflows" are really verified. The guard supplements
 * looking at the screenshots; it never replaces it.
 *
 * Seeded (e2e/fixtures/seed/visual): the real device name "SA430 08FF41E50F8B3A34" (22 chars), a
 * 22-char and a 60-char SA430 name (fake serials, so they are Not detected), a failing simulator,
 * an SA430 with a long serial-port path and the simulator.
 */
import { browser, expect as wdioExpect } from '@wdio/globals';

import {
  assertNoOverflow,
  byTestId,
  closeSourceMenu,
  ensureDisconnected,
  entryByName,
  fillDialog,
  findOverflow,
  livenessKind,
  openAddSourceDialog,
  openEditDialog,
  openSourceMenu,
  runTestConnection,
  selectSource,
  shot,
  sourceButtonText,
  waitForState,
  type Box,
  failureBanner,
} from './helpers';

const REAL = 'SA430 08FF41E50F8B3A34';
const N22 = 'Bench SA430 analyzer 2';
const N60 = 'Very long source name used to check that truncation is clean';
const LONG_PORT = 'Seeded long port';
const WIDTHS = [1180, 1024, 520];
const HEIGHT = 820;
const TOL = 0.6;

/** `expect(value, message)`: wdio's expect without a message argument; the message prefixes a failure. */
function expect(actual: unknown, message?: string) {
  type Matchers = Record<string, (...args: unknown[]) => unknown>;
  const wrap = (matchers: Matchers): Matchers =>
    new Proxy(matchers, {
      get: (target, key: string) => {
        const value = target[key];
        if (typeof value !== 'function')
          return value && typeof value === 'object' ? wrap(value as Matchers) : value;
        return (...args: unknown[]) => {
          try {
            return value.apply(target, args);
          } catch (e) {
            throw new Error(`${message ?? ''}: ${(e as Error).message}`);
          }
        };
      },
    });
  return wrap(wdioExpect(actual) as unknown as Matchers) as unknown as ReturnType<
    typeof wdioExpect
  >;
}

const describeHardware = process.env.SPECTRUM_E2E_SA430 === '1' ? describe : describe.skip;

interface Row {
  testId: string;
  label: string;
  twoLine: boolean;
  item: Box;
  name: Box;
  badge: Box | null;
  badgeText: string | null;
  sub: Box | null;
  actions: Box | null;
  nameScroll: number;
  nameClient: number;
  hasTitle: boolean;
}

/** Resizes the window and reports the width the web view really got (a minimum may clamp it). */
async function resize(width: number): Promise<number> {
  await browser.setWindowSize(width, HEIGHT);
  await browser.pause(250);
  return browser.execute(() => window.innerWidth);
}

/**
 * Waits until the row's hover actions have finished their 150 ms slide (transform back to `none`,
 * no running animation). Measuring during the slide would compare a moving box with the badge.
 */
async function waitForActionsSettled(testId: string) {
  await browser.waitUntil(
    async () =>
      browser.execute((t) => {
        const row = document.querySelector(`[data-testid="${t}"]`)?.closest('.source-row');
        const actions = row?.querySelector<HTMLElement>('.source-actions');
        if (!actions) return false;
        return (
          getComputedStyle(actions).transform === 'none' && actions.getAnimations().length === 0
        );
      }, testId),
    { timeoutMsg: `the hover actions of ${testId} did not settle` },
  );
}

/** Layout of every item in the open menu, in real pixels. */
async function measureRows(): Promise<Row[]> {
  return browser.execute(() => {
    const box = (el: Element | null): Box | null => {
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
    };
    const out: Row[] = [];
    for (const item of Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="source-menu"] .source-item'),
    )) {
      const name = item.querySelector<HTMLElement>('.src-name');
      if (!name) continue;
      const badge = item.querySelector<HTMLElement>('.src-badge');
      const row = item.closest('.source-row');
      out.push({
        testId: item.dataset['testid'] ?? '',
        label: item.dataset['label'] ?? '',
        twoLine: item.querySelector('.row-sub') !== null,
        item: box(item)!,
        name: box(name)!,
        badge: box(badge),
        badgeText: badge?.textContent ?? null,
        sub: box(item.querySelector('.row-sub')),
        actions: box(row?.querySelector('.source-actions') ?? null),
        nameScroll: name.scrollWidth,
        nameClient: name.clientWidth,
        hasTitle: (item.getAttribute('title') ?? '').includes(item.dataset['label'] ?? '\u0000'),
      });
    }
    return out;
  });
}

const close = (a: number, b: number) => Math.abs(a - b) <= TOL;

/** The contract of design 2.1: constant name column, 64px badge column, line 2 everywhere. */
function assertRowLayout(rows: Row[], where: string) {
  const two = rows.filter((r) => r.twoLine);
  expect(two.length, `${where}: expected the 6 seeded rows`).toBeGreaterThanOrEqual(6);
  const badged = rows.filter((r) => r.badge !== null);
  // Two kinds are seeded (USB and Built-in); the file kind was removed with the recordings.
  expect(
    new Set(badged.map((r) => r.badgeText)).size,
    `${where}: badges vary`,
  ).toBeGreaterThanOrEqual(2);
  for (const r of badged) {
    expect(
      close(r.badge!.width, 64),
      `${where}: badge width of ${r.label} is ${r.badge!.width}`,
    ).toBe(true);
    expect(close(r.badge!.left, badged[0]!.badge!.left), `${where}: badge left of ${r.label}`).toBe(
      true,
    );
  }
  for (const r of rows) {
    expect(close(r.name.left, rows[0]!.name.left), `${where}: name left of ${r.label}`).toBe(true);
    expect(
      close(r.name.right, rows[0]!.name.right),
      `${where}: name right of ${r.label} (${r.name.right} vs ${rows[0]!.name.right})`,
    ).toBe(true);
  }
  for (const r of two) {
    expect(r.sub!.height, `${where}: line 2 of ${r.label}`).toBeGreaterThan(8);
    expect(close(r.item.height, two[0]!.item.height), `${where}: row height of ${r.label}`).toBe(
      true,
    );
  }
  for (const r of rows) {
    // Truncation is only allowed when the full name is available as a tooltip.
    if (r.nameScroll > r.nameClient + 1)
      expect(r.hasTitle, `${where}: ${r.label} truncated without title`).toBe(true);
  }
}

/** The popover (and optionally the dialog) must lie fully inside the window, without scrolling sideways. */
async function assertInsideWindow(selector: string, where: string) {
  const metrics = await browser.execute((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      iw: window.innerWidth,
      ih: window.innerHeight,
      sw: el.scrollWidth,
      cw: el.clientWidth,
      pageSw: document.documentElement.scrollWidth,
    };
  }, selector);
  expect(metrics.left, `${where}: left`).toBeGreaterThanOrEqual(-0.5);
  expect(metrics.right, `${where}: right`).toBeLessThanOrEqual(metrics.iw + 0.5);
  expect(metrics.top, `${where}: top`).toBeGreaterThanOrEqual(-0.5);
  expect(metrics.bottom, `${where}: bottom`).toBeLessThanOrEqual(metrics.ih + 0.5);
  expect(metrics.sw, `${where}: horizontal scroll`).toBeLessThanOrEqual(metrics.cw + 1);
  expect(metrics.pageSw, `${where}: page scrolls sideways`).toBeLessThanOrEqual(metrics.iw + 1);
}

/** Computed style of the status circle (its ::before) of the first matching dot. */
async function glyph(selector: string) {
  return browser.execute((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el, '::before');
    return {
      content: cs.content,
      background: cs.backgroundColor,
      borderWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      color: getComputedStyle(el).color,
      radius: cs.borderTopLeftRadius,
      width: cs.width,
    };
  }, selector);
}

describe('Visual guard: source button, menu and dialog', () => {
  const actual: number[] = [];

  before(async () => {
    for (const w of WIDTHS) actual.push(await resize(w));
    console.log(`window widths requested ${WIDTHS.join('/')}, web view got ${actual.join('/')}`);
  });

  after(async () => {
    await browser.setWindowSize(1440, 900);
  });

  for (const w of WIDTHS) {
    it(`menu rows keep one name column and a 64px badge column at ${w}px`, async () => {
      const real = await resize(w);
      await closeSourceMenu();
      await openSourceMenu();
      const where = `${w} (got ${real})`;
      const rows = await measureRows();
      assertRowLayout(rows, where);
      // The real 22-char device name is shown in full; the 60-char one only truncates with a title.
      const realRow = rows.find((r) => r.label === REAL)!;
      expect(realRow.nameScroll, `${where}: ${REAL} must not be truncated`).toBeLessThanOrEqual(
        realRow.nameClient + 1,
      );
      const n60 = rows.find((r) => r.label === N60)!;
      expect(
        n60.nameScroll,
        `${where}: the 60-char name does not fit and is ellipsised`,
      ).toBeGreaterThan(n60.nameClient);
      expect(n60.hasTitle).toBe(true);
      await assertInsideWindow('[data-testid="source-menu"]', `menu ${where}`);
      await assertNoOverflow('[data-testid="source-menu"]');
      await shot(`typical-menu-${real}-seeded`);
      await closeSourceMenu();
    });

    it(`hover and focus move nothing, and the actions stay in the badge column at ${w}px`, async () => {
      const real = await resize(w);
      await closeSourceMenu();
      await openSourceMenu();
      for (const label of [N60, LONG_PORT, REAL]) {
        const id = (await (await entryByName(label)).getAttribute('data-testid'))!;
        const before = (await measureRows()).find((r) => r.testId === id)!;
        // Focus is what WebKit honours everywhere; the hover is tried as well.
        await (await byTestId(id)).moveTo();
        await browser.execute(
          (t) => (document.querySelector(`[data-testid="${t}"]`) as HTMLElement).focus(),
          id,
        );
        await waitForActionsSettled(id);
        const after = (await measureRows()).find((r) => r.testId === id)!;
        for (const part of ['item', 'name', 'badge', 'sub'] as const) {
          for (const side of ['left', 'right', 'top', 'bottom'] as const) {
            expect(
              close(after[part]![side], before[part]![side]),
              `${label}: ${part}.${side} moved (${before[part]![side]} -> ${after[part]![side]}) at ${real}`,
            ).toBe(true);
          }
        }
        const a = after.actions!;
        expect(a.width, 'the actions are shown while focused').toBeGreaterThan(0);
        expect(a.left, `${label}: actions start inside the badge column`).toBeGreaterThanOrEqual(
          after.badge!.left - TOL,
        );
        expect(a.right, `${label}: actions end inside the badge column`).toBeLessThanOrEqual(
          after.badge!.right + TOL,
        );
        expect(a.left, `${label}: actions do not touch line 2`).toBeGreaterThanOrEqual(
          after.sub!.right - TOL,
        );
        if (label === N60) await shot(`row-actions-${real}-long-name`);
      }
      await closeSourceMenu();
    });
  }

  // KNOWN DEFECT (reported to the staff engineer, see the T16 handoff): on a two-line row the hover
  // actions start 5.5px above the bottom of the badge pill (actions top 181 vs badge bottom 186.5
  // at 1180px), so they cover its lower edge. Design 2.1 puts them on line 2 under the badge.
  // The assertion is real and fails today; enable this test once source.css is fixed.
  it('hover actions sit below the badge pill instead of covering it', async () => {
    await resize(1180);
    await openSourceMenu();
    const id = (await (await entryByName(N60)).getAttribute('data-testid'))!;
    await browser.execute(
      (t) => (document.querySelector(`[data-testid="${t}"]`) as HTMLElement).focus(),
      id,
    );
    const row = (await measureRows()).find((r) => r.testId === id)!;
    expect(
      row.actions!.top,
      `actions top ${row.actions!.top} vs badge bottom ${row.badge!.bottom}`,
    ).toBeGreaterThanOrEqual(row.badge!.bottom - TOL);
    await closeSourceMenu();
  });

  it('status circles differ by more than colour: connected, idle, absent and failed', async () => {
    await openSourceMenu();
    const idle = await glyph('[data-testid="source-entry-vis-fail"] .src-dot');
    const absent = await glyph('[data-testid="source-entry-vis-22"] .src-dot');
    expect(idle?.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(absent?.background, 'absent is an empty ring').toBe('rgba(0, 0, 0, 0)');
    expect(absent?.borderWidth).toBe('2px');
    expect(idle?.borderWidth).toBe('0px');
    expect(idle?.radius).not.toBe('0px');
    await closeSourceMenu();

    const w1180 = await resize(1180);
    // failed: pick the 60-char row (its device is not there), then look at the cross.
    await selectSource('source-entry-vis-60');
    await (await failureBanner()).waitForDisplayed();
    await openSourceMenu();
    const failed = await glyph('[data-testid="source-entry-vis-60"] .src-dot');
    expect(failed?.content).toContain('✕');
    expect(failed?.color).not.toBe(idle?.color);
    await shot(`failed-row-${w1180}-long-name`);
    await closeSourceMenu();

    // connected: the green token with a halo, nothing else looks like it.
    await selectSource('source-entry-vis-sim');
    await waitForState('Connected');
    await openSourceMenu();
    const connected = await glyph('[data-testid="source-entry-vis-sim"] .src-dot');
    expect(connected?.background).not.toBe(idle?.background);
    expect(connected?.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(connected?.borderWidth).toBe('0px');
    const halo = await browser.execute(
      () =>
        getComputedStyle(
          document.querySelector('[data-testid="source-entry-vis-sim"] .src-dot')!,
          '::before',
        ).boxShadow,
    );
    expect(halo).not.toBe('none');
    const states = new Set([connected?.background, idle?.background, absent?.background]);
    expect(states.size, 'three distinct fills').toBe(3);
    await shot(`connected-halo-menu-${w1180}-sim`);
    await closeSourceMenu();
    await shot(`connected-${w1180}-sim`);
    await ensureDisconnected();
  });

  it('connecting is a pulsing blue circle (state forced on a copy of the glyph)', async () => {
    const real = await resize(1180);
    // The simulator connects too fast to catch the state, so the real CSS is rendered by setting
    // the attribute on one dot. React rewrites it on its next render of that row.
    await openSourceMenu();
    await browser.execute(() => {
      document
        .querySelector('[data-testid="source-entry-vis-sim"] .src-dot')!
        .setAttribute('data-status', 'connecting');
    });
    const g = await glyph('[data-testid="source-entry-vis-sim"] .src-dot');
    const idle = await glyph('[data-testid="source-entry-vis-fail"] .src-dot');
    expect(g?.background).not.toBe(idle?.background);
    await shot(`connecting-forced-menu-${real}-sim`);
    await closeSourceMenu();
  });

  for (const w of WIDTHS) {
    it(`the source button stays between 150 and 280px and truncates only with a full-name label at ${w}px`, async () => {
      const real = await resize(w);
      for (const [label, expectFull, id] of [
        [N60, false, 'source-entry-vis-60'],
        [N22, true, 'source-entry-vis-22'],
        [REAL, true, 'source-entry-vis-real'],
      ] as const) {
        await closeSourceMenu();
        await selectSource(id);
        await browser.waitUntil(async () => (await sourceButtonText()).includes(label), {
          timeoutMsg: `the source button never showed ${label}`,
        });
        await browser.pause(300);
        const m = await browser.execute(() => {
          const b = document.querySelector<HTMLElement>('[data-testid="source-button"]')!;
          const n = b.querySelector<HTMLElement>('.src-name')!;
          const r = b.getBoundingClientRect();
          return {
            w: r.width,
            scroll: n.scrollWidth,
            client: n.clientWidth,
            aria: b.getAttribute('aria-label') ?? '',
            brandH: document.querySelector<HTMLElement>('.brand')!.getBoundingClientRect().height,
            brandLine: parseFloat(getComputedStyle(document.querySelector('.brand')!).lineHeight),
            toolbarH: document.querySelector<HTMLElement>('.toolbar')!.getBoundingClientRect()
              .height,
            pageSw: document.documentElement.scrollWidth,
            iw: window.innerWidth,
            toolbarOverflow:
              (document.querySelector('.toolbar') as HTMLElement).scrollWidth -
              (document.querySelector('.toolbar') as HTMLElement).clientWidth,
          };
        });
        const where = `${label} at ${real}`;
        expect(m.w, `${where}: button width`).toBeGreaterThanOrEqual(149.5);
        expect(m.w, `${where}: button width`).toBeLessThanOrEqual(280.5);
        expect(m.aria, `${where}: aria-label carries the full name`).toContain(label);
        if (expectFull)
          expect(m.scroll, `${where}: name truncated`).toBeLessThanOrEqual(m.client + 1);
        else expect(m.scroll, `${where}: 60-char name must ellipsise`).toBeGreaterThan(m.client);
        expect(m.pageSw, `${where}: page scrolls sideways`).toBeLessThanOrEqual(m.iw + 1);
        expect(m.toolbarOverflow, `${where}: toolbar overflows`).toBeLessThanOrEqual(1);
        // The brand stays on one line (a wrapped brand makes the toolbar taller).
        expect(m.brandH, `${where}: brand wrapped to ${m.brandH}px`).toBeLessThan(
          (Number.isNaN(m.brandLine) ? 24 : m.brandLine) * 1.5,
        );
        expect(m.toolbarH, `${where}: toolbar height ${m.toolbarH}`).toBeLessThanOrEqual(50);
        expect(await findOverflow('[data-testid="source-button"]')).toEqual([]);
        await shot(
          `button-${label === N60 ? 'long-name' : label === N22 ? '22-char' : 'real-serial'}-${real}-seeded`,
        );
      }
    });
  }

  it('lists a device that is not there as Not detected with an empty ring', async () => {
    const real = await resize(1180);
    await openSourceMenu();
    const row = await entryByName(N22);
    expect(await row.$('.src-dot').getAttribute('data-status')).toBe('absent');
    await shot(`absent-device-menu-${real}-seeded`);
    await closeSourceMenu();
  });

  it('connected: the Edit dialog locks the connection and fits the window', async () => {
    const w = await resize(1180);
    await ensureDisconnected();
    await selectSource('source-entry-vis-sim');
    await waitForState('Connected');
    await openEditDialog('source-entry-vis-sim');
    await assertInsideWindow('[data-testid="add-source-dialog"]', 'edit dialog');
    await assertNoOverflow('[data-testid="add-source-dialog"]');
    await shot(`edit-connected-lock-${w}-sim`);
    await (await byTestId('add-source-cancel')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    await ensureDisconnected();
  });

  for (const w of [1180, 1024]) {
    it(`Add dialog (empty, then failed test) fits the window and clips nothing at ${w}px`, async () => {
      const real = await resize(w);
      await openAddSourceDialog();
      await assertInsideWindow('[data-testid="add-source-dialog"]', `add dialog ${real}`);
      await assertNoOverflow('[data-testid="add-source-dialog"]');
      await shot(`add-dialog-empty-${real}-seeded`);
      await fillDialog({
        name: N60,
        port: '/dev/spectrum-e2e-no-such-port-with-a-rather-long-path-name',
      });
      // A 60-char name collides with the seeded row: use a free name of the same length.
      await fillDialog({ name: `${N60.slice(0, 55)} 0001` });
      const result = await runTestConnection();
      expect(result).toContain('Test failed:');
      await assertInsideWindow('[data-testid="add-source-dialog"]', `add dialog failed ${real}`);
      await assertNoOverflow('[data-testid="add-source-dialog"]');
      await shot(`add-dialog-failed-${real}-long-port`);
      await (await byTestId('add-source-cancel')).click();
      await byTestId('add-source-dialog').waitForExist({ reverse: true });
    });
  }

  it('is still usable at the narrowest window', async () => {
    const real = await resize(WIDTHS[WIDTHS.length - 1]!);
    await openSourceMenu();
    await assertInsideWindow('[data-testid="source-menu"]', `menu at ${real}`);
    await shot(`narrow-menu-${real}-seeded`);
    await closeSourceMenu();
    await shot(`narrow-${real}-seeded`);
  });
});

/**
 * The whole chrome must fit the window. `scrollWidth` alone is not enough: an overrun of the
 * toolbar and the side panel is clipped by the window, not scrolled, so it passes that check
 * (R2-2). Every toolbar child, the toolbar itself, and the side panel must end
 * inside `innerWidth`.
 */
async function assertChromeFits(where: string) {
  const m = await browser.execute(() => {
    const right = (el: Element | null) => (el ? el.getBoundingClientRect().right : null);
    const toolbar = document.querySelector('.toolbar')!;
    return {
      iw: window.innerWidth,
      pageSw: document.documentElement.scrollWidth,
      toolbar: right(toolbar),
      children: Array.from(toolbar.children).map((c) => ({
        name: c.className,
        right: right(c)!,
        parts: Array.from(c.children).map(
          (p) => `${p.className.split(' ')[0]}:${Math.round(p.getBoundingClientRect().width)}`,
        ),
      })),
      panel: right(document.querySelector('.side-panel')),
    };
  });
  const limit = m.iw + 0.5;
  expect(m.pageSw, `${where}: page scrolls sideways`).toBeLessThanOrEqual(m.iw + 1);
  expect(m.toolbar, `${where}: toolbar right edge ${m.toolbar} > ${m.iw}`).toBeLessThanOrEqual(
    limit,
  );
  for (const c of m.children)
    expect(
      c.right,
      `${where}: toolbar child .${c.name} ends at ${c.right} > ${m.iw} (${c.parts.join(' ')})`,
    ).toBeLessThanOrEqual(limit);
  expect(m.panel, `${where}: side panel exists`).not.toBeNull();
  expect(m.panel!, `${where}: side panel right edge ${m.panel} > ${m.iw}`).toBeLessThanOrEqual(
    limit,
  );
}

/**
 * The source name must never look cropped (T19). Names of up to 22 characters are shown in full
 * (`scrollWidth <= clientWidth`); with the SIMULATED badge present at least `minChars` characters
 * must be visible; longer names must ellipsise deliberately, with the full name in the tooltip.
 */
async function assertNameVisible(where: string, name: string, minChars: number) {
  const m = await browser.execute(() => {
    const btn = document.querySelector('[data-testid="source-button"]')!;
    const el = btn.querySelector('.src-name')!;
    return {
      sw: el.scrollWidth,
      cw: el.clientWidth,
      title: btn.getAttribute('title') ?? '',
      aria: btn.getAttribute('aria-label') ?? '',
    };
  });
  const center = await browser.execute(() => {
    const el = document.querySelector<HTMLInputElement>('.toolbar .freq-input')!;
    return { sw: el.scrollWidth, cw: el.clientWidth };
  });
  expect(center.sw, `${where}: Center frequency text is clipped`).toBeLessThanOrEqual(center.cw);
  const visible = Math.floor(name.length * Math.min(1, m.cw / m.sw));
  if (name.length <= 22) {
    expect(
      visible,
      `${where}: name cropped (${m.cw}px of ${m.sw}px, about ${visible}/${name.length} chars)`,
    ).toBeGreaterThanOrEqual(minChars);
  } else {
    expect(m.sw, `${where}: a long name must ellipsise`).toBeGreaterThan(m.cw);
    expect(m.title, `${where}: tooltip keeps the full name`).toContain(name);
  }
  expect(m.aria, `${where}: aria-label keeps the full name`).toContain(name);
}

describe('Visual guard: the toolbar and side panel fit the window (R2-2)', () => {
  const FIT_WIDTHS = [1180, 1024];
  const SIM_ID = 'source-entry-vis-sim';
  const N22_SIM = 'Simulated bench unit 2'; // 22 chars, unique among the seeded names
  const longSim = `Sim ${N60}`.slice(0, 60);

  after(async () => {
    await browser.setWindowSize(1440, 900);
  });

  // Idle: the seeded SA430 entries cannot connect here (or the real one is not attached), so the
  // button shows the picked name while the session stays disconnected / failed.
  for (const [label, id] of [
    [N22, 'source-entry-vis-22'],
    [REAL, 'source-entry-vis-real'],
    [N60, 'source-entry-vis-60'],
  ] as const) {
    it(`idle with "${label.slice(0, 22)}" (${label.length} chars)`, async () => {
      await closeSourceMenu();
      await selectSource(id);
      await browser.waitUntil(async () => (await sourceButtonText()).includes(label), {
        timeoutMsg: `the source button never showed ${label}`,
      });
      for (const w of FIT_WIDTHS) {
        const real = await resize(w);
        await browser.pause(300);
        await assertChromeFits(`idle ${label.length} chars at ${real}`);
        await assertNameVisible(`idle ${label.length} chars at ${real}`, label, label.length);
        await shot(`toolbar-idle-${label.length}-${real}-seeded`);
      }
    });
  }

  // Connected and acquiring: the simulator entry renamed to the name under test.
  for (const name of [N22_SIM, longSim]) {
    it(`connected and acquiring with a ${name.length}-char name`, async () => {
      await resize(1180);
      await ensureDisconnected();
      await openEditDialog(SIM_ID);
      await fillDialog({ name });
      await (await byTestId('add-source-save')).click();
      await byTestId('add-source-dialog').waitForExist({ reverse: true });
      await closeSourceMenu();
      await selectSource(SIM_ID);
      await waitForState('Connected');
      for (const w of FIT_WIDTHS) {
        const real = await resize(w);
        await browser.pause(300);
        await assertChromeFits(`connected ${name.length} chars at ${real}`);
        await assertNameVisible(`connected at ${real}`, name, 18);
        await shot(`toolbar-connected-${name.length}-${real}-seeded`);
      }
      await (await byTestId('acquire-button')).click();
      await waitForState('Acquiring');
      await browser.waitUntil(async () => (await livenessKind()) === 'live', {
        timeoutMsg: 'plot did not become live',
      });
      for (const w of FIT_WIDTHS) {
        const real = await resize(w);
        await browser.pause(300);
        await assertChromeFits(`acquiring ${name.length} chars at ${real}`);
        await assertNameVisible(`acquiring at ${real}`, name, 18);
        await shot(`toolbar-acquiring-${name.length}-${real}-seeded`);
      }
      await (await byTestId('acquire-button')).click();
      await waitForState('Connected');
    });
  }
});

describeHardware('Visual guard with the real SA430', () => {
  it('shows the real device name in full while connected and acquiring (no badge)', async () => {
    await resize(1180);
    await ensureDisconnected();
    await closeSourceMenu();
    await selectSource('source-entry-vis-real');
    await waitForState('Connected');
    for (const w of [1180, 1024]) {
      const real = await resize(w);
      await browser.pause(300);
      await assertChromeFits(`real connected at ${real}`);
      await assertNameVisible(`real connected at ${real}`, REAL, REAL.length);
      await shot(`toolbar-connected-real-${real}-sa430`);
    }
    await (await byTestId('acquire-button')).click();
    await waitForState('Acquiring');
    await browser.waitUntil(async () => (await livenessKind()) === 'live', {
      timeoutMsg: 'plot did not become live',
    });
    for (const w of [1180, 1024]) {
      const real = await resize(w);
      await browser.pause(300);
      await assertChromeFits(`real acquiring at ${real}`);
      await assertNameVisible(`real acquiring at ${real}`, REAL, REAL.length);
      await shot(`toolbar-acquiring-real-${real}-sa430`);
    }
    await (await byTestId('acquire-button')).click();
    await waitForState('Connected');
    await ensureDisconnected();
  });

  it('Add dialog OK state shows the serial and fits', async () => {
    await resize(1180);
    await openAddSourceDialog();
    await fillDialog({ name: 'E2E visual SA430', port: '/dev/ttyACM0' });
    const text = await runTestConnection();
    expect(text).toContain('Connection OK');
    await assertNoOverflow('[data-testid="add-source-dialog"]');
    await shot('add-dialog-ok-1180-sa430');
    await (await byTestId('add-source-cancel')).click();
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
  });
});

// The mismatch state (a different SA430 answering on the stored port) needs a second analyzer;
// it cannot be faked in the real app, so it is reported as skipped rather than mocked.
describe.skip('Visual guard: mismatch state (needs two SA430 analyzers)', () => {
  it('shows the Different device warning', () => undefined);
});
