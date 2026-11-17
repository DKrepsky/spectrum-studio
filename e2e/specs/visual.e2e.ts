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
import { $, $$, browser, expect as wdioExpect } from '@wdio/globals';

import {
  assertNoOverflow,
  byTestId,
  chooseMode,
  closeSourceMenu,
  ensureDisconnected,
  ensureWindowFocus,
  entryByName,
  failureBanner,
  fillDialog,
  findOverflow,
  livenessKind,
  openAddSourceDialog,
  openEditDialog,
  openSourceMenu,
  clickRowAction,
  revealRowActions,
  runTestConnection,
  selectSource,
  setInput,
  shot,
  sourceButtonText,
  type Box,
  waitForGone,
  waitForLaunchSettled,
  waitForState,
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

// ---- States of the T0 baseline (plan 11): panels, banners, status bar, plot tags, capture ------
// Every shot here is a state the real app reaches with the seeded simulator. Names are stable so
// the before and after sets pair by file name; `{real}` is the innerWidth the web view really got.

const SIM = 'source-entry-vis-sim';
const STATE_WIDTHS = [1440, 1257, 1180, 1024];
const WIDE = [1440, 1024];

/** Dismisses every notice banner, so a shot shows only the state it is about. */
async function dismissBanners() {
  await browser.execute(() =>
    document
      .querySelectorAll<HTMLButtonElement>('.ui-banner button[aria-label="Dismiss"]')
      .forEach((b) => b.click()),
  );
  await browser.pause(200);
}

/** Connects the seeded simulator and starts acquisition; returns once frames reach the plot. */
async function simulatorLive() {
  await ensureDisconnected();
  await dismissBanners();
  await selectSource(SIM);
  await waitForState('Connected');
  await (await byTestId('acquire-button')).click();
  await waitForState('Acquiring');
  await browser.waitUntil(async () => (await livenessKind()) === 'live', {
    timeoutMsg: 'plot did not become live',
  });
}

/** Pauses acquisition (the trace stays on screen as HOLD). */
async function pauseAcquisition() {
  await (await byTestId('acquire-button')).click();
  await waitForState('Connected');
}

/** Scrolls the side panel so that the section with this title starts at its top. */
async function showSection(title: string) {
  await browser.execute((t) => {
    const summary = Array.from(document.querySelectorAll<HTMLElement>('.side-panel summary')).find(
      (el) => el.textContent?.trim() === t,
    );
    if (!summary) throw new Error(`no side panel section "${t}"`);
    summary.scrollIntoView({ block: 'start' });
  }, title);
  await browser.pause(200);
}

/** Number of peak rows (the table shows a hint row instead while there are none). */
async function peakRowCount(): Promise<number> {
  return browser.execute(
    () =>
      Array.from(document.querySelectorAll('[data-testid="peak-table"] tbody tr')).filter(
        (r) => !r.classList.contains('ui-table-empty'),
      ).length,
  );
}

/**
 * Injects a status the simulator cannot produce on its own (a stale trace, a single capture in
 * progress, a warning, a lost device). The UI drops out-of-order statuses, so the revision is set
 * far above the backend's. The backend stays unchanged, so the injected status is what is shown.
 * Frames are cleared on `connecting`, so that state is injected last (see its describe block).
 */
let injections = 0;
async function injectStatus(patch: Record<string, unknown>) {
  injections += 1;
  const step = injections;
  await browser.execute(
    async (p: Record<string, unknown>, n: number) => {
      const tauri = (
        window as unknown as {
          __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<any> };
        }
      ).__TAURI_INTERNALS__;
      const current = await tauri.invoke('get_status');
      await tauri.invoke('plugin:event|emit', {
        event: 'session-status',
        payload: { ...current, ...p, revision: current.revision + 1000 + n },
      });
    },
    patch,
    step,
  );
  await browser.pause(300);
}

describe('Visual guard: panels, banners, status bar, plot tags and capture control', () => {
  after(async () => {
    await resizeTo(1440, 900);
  });

  for (const w of WIDE) {
    it(`side panel sections with a live simulator at ${w}px`, async () => {
      const real = await resize(w);
      await simulatorLive();
      await browser.waitUntil(async () => (await peakRowCount()) > 0, {
        timeoutMsg: 'the simulator produced no peaks',
      });
      await showSection('Measurement');
      await shot(`panel-measurement-${real}-sim`);

      await (await $('button=+ Marker')).click();
      await (await $('button=+ Marker')).click();
      await browser.waitUntil(
        async () => (await $$('[data-testid="marker-table"] tbody tr')).length === 2,
        { timeoutMsg: 'two markers were not placed' },
      );
      await showSection('Markers');
      await shot(`panel-markers-two-${real}-sim`);
      await browser.execute(() =>
        document
          .querySelectorAll<HTMLButtonElement>(
            '[data-testid="marker-table"] button[title="Remove marker"]',
          )
          .forEach((b) => b.click()),
      );

      await showSection('Peaks');
      await shot(`panel-peaks-rows-${real}-sim`);

      const maxPeaks = await $('input[aria-label="Maximum peaks"]');
      const original = await maxPeaks.getValue();
      await maxPeaks.click();
      await browser.keys(['Control', 'a']);
      await browser.keys(['Backspace']);
      await maxPeaks.addValue('99');
      expect(
        await maxPeaks.getAttribute('aria-invalid'),
        'the out-of-range peak count is flagged',
      ).toBe('true');
      await shot(`panel-invalid-field-${real}-sim`);
      await setInput('input[aria-label="Maximum peaks"]', original);

      await showSection('Display');
      await shot(`panel-display-${real}-sim`);

      await (await $('summary=Source settings')).click();
      await showSection('Source settings');
      await shot(`panel-source-settings-${real}-sim`);
      await (await $('summary=Source settings')).click();
    });

    it(`source menu: Undo toast and keyboard focus at ${w}px`, async () => {
      const real = await resize(w);
      await dismissBanners();
      await closeSourceMenu();
      await openSourceMenu();
      await clickRowAction('source-entry-vis-port', 'source-forget');
      await byTestId('source-forgot-toast').waitForDisplayed({
        timeoutMsg: 'the Undo toast did not appear',
      });
      await shot(`menu-undo-toast-${real}`);
      await (await byTestId('source-undo')).click();
      await waitForGone('source-forgot-toast');
      await closeSourceMenu();

      await browser.execute(() => (document.activeElement as HTMLElement | null)?.blur());
      for (let i = 0; i < 10; i += 1) {
        if (
          (await browser.execute(() => document.activeElement?.getAttribute('data-testid'))) ===
          'source-button'
        )
          break;
        await browser.keys(['Tab']);
      }
      await browser.keys(['ArrowDown']);
      await byTestId('source-menu').waitForDisplayed();
      // The focus ring of a popover row is drawn inside the row (as before 009), so it is not clipped
      // by the list edge. The ring applies only while the window has OS focus.
      await ensureWindowFocus();
      await browser.pause(200);
      const ring = await browser.execute(() => {
        const el = document.activeElement as HTMLElement;
        return {
          row: el.getAttribute('data-testid'),
          focusVisible: el.matches(':focus-visible'),
          offset: getComputedStyle(el).outlineOffset,
        };
      });
      expect(ring.focusVisible, `the focused row ${ring.row} shows its focus ring`).toBe(true);
      expect(ring.offset, `the focus ring of ${ring.row} is inside the row`).toBe('-2px');
      await shot(`menu-keyboard-focus-${real}`);
      await closeSourceMenu();
    });

    it(`zoomed plot shows the zoom reset control at ${w}px`, async () => {
      const real = await resize(w);
      await simulatorLive();
      await browser.execute(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-testid="spectrum-canvas"]',
        )!;
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -120,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await (await $('.plot-zoom-reset')).waitForDisplayed({ timeoutMsg: 'no zoom reset control' });
      await shot(`plot-zoom-reset-${real}`);
      await (await $('.plot-zoom-reset')).click();
      await (await $('.plot-zoom-reset')).waitForExist({ reverse: true });
      await pauseAcquisition();
    });

    it(`capture control: unavailable, idle teal and violet, acquiring and keyboard focus at ${w}px`, async () => {
      const real = await resize(w);
      await ensureDisconnected();
      await dismissBanners();
      await shot(`capture-unavailable-${real}`);

      await selectSource(SIM);
      await waitForState('Connected');
      await chooseMode('continuous');
      await shot(`capture-idle-continuous-${real}`);
      await chooseMode('single');
      await shot(`capture-idle-single-${real}`);
      await chooseMode('continuous');

      await (await byTestId('acquire-button')).click();
      await waitForState('Acquiring');
      await browser.pause(400);
      await shot(`capture-acquiring-continuous-${real}`);
      await pauseAcquisition();

      await browser.execute(() => (document.activeElement as HTMLElement | null)?.blur());
      for (let i = 0; i < 10; i += 1) {
        if (
          (await browser.execute(() => document.activeElement?.getAttribute('data-testid'))) ===
          'acquire-button'
        )
          break;
        await browser.keys(['Tab']);
      }
      await shot(`capture-focus-keyboard-${real}`);
    });

    it(`connect failure banner with Reconnect at ${w}px`, async () => {
      const real = await resize(w);
      await ensureDisconnected();
      await dismissBanners();
      await selectSource('source-entry-vis-fail');
      await (await failureBanner()).waitForDisplayed();
      await (await byTestId('reconnect-button')).waitForDisplayed();
      await shot(`banner-connect-failed-reconnect-${real}`);
      await dismissBanners();
    });
  }

  for (const w of STATE_WIDTHS) {
    it(`status bar and plot tag: no source, no frame, live and hold at ${w}px`, async () => {
      const real = await resize(w);
      await ensureDisconnected();
      await dismissBanners();
      await shot(`statusbar-no-source-${real}`);

      await selectSource(SIM);
      await waitForState('Connected');
      await browser.pause(400);
      await shot(`statusbar-no-frame-${real}`);

      await (await byTestId('acquire-button')).click();
      await waitForState('Acquiring');
      await browser.waitUntil(async () => (await livenessKind()) === 'live', {
        timeoutMsg: 'plot did not become live',
      });
      await browser.pause(700);
      await shot(`statusbar-live-${real}`);

      await pauseAcquisition();
      await browser.pause(400);
      await shot(`statusbar-hold-${real}`);
    });
  }
});

const describeHardware = process.env.SPECTRUM_E2E_SA430 === '1' ? describe : describe.skip;

interface Row {
  testId: string;
  label: string;
  /** The visible name (the accessible label also carries a status word). */
  nameText: string;
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

/**
 * Resizes the window and returns the width the web view settled at (a minimum may clamp it). A read
 * taken straight after the resize can still show the previous width (QA: 51 of 88 shots were named
 * with the wrong width), so the width counts only when two reads 100 ms apart agree. A short pause
 * then lets the new frame paint before a shot is taken.
 */
async function resizeTo(width: number, height: number): Promise<number> {
  await browser.setWindowSize(width, height);
  let previous = -1;
  let settled = -1;
  await browser.waitUntil(
    async () => {
      const now = await browser.execute(() => window.innerWidth);
      if (now === previous) settled = now;
      previous = now;
      return settled === now;
    },
    { timeout: 5000, interval: 100, timeoutMsg: `the window did not settle at ${width}px` },
  );
  await browser.pause(150);
  return settled;
}

function resize(width: number): Promise<number> {
  return resizeTo(width, HEIGHT);
}

/**
 * Waits until the row's hover actions have finished their 150 ms slide (transform back to `none`,
 * no running animation). Measuring during the slide would compare a moving box with the badge.
 */
async function waitForActionsSettled(testId: string) {
  await browser.waitUntil(
    async () =>
      browser.execute((t) => {
        const row = document.querySelector(`[data-testid="${t}"]`)?.closest('[data-list-row]');
        const actions = row?.querySelector<HTMLElement>('[data-row-action]')?.parentElement;
        if (!actions) return false;
        return (
          getComputedStyle(actions).transform === 'none' && actions.getAnimations().length === 0
        );
      }, testId),
    { timeoutMsg: `the hover actions of ${testId} did not settle` },
  );
}

/** Layout of every remembered or detected row in the open menu, in real pixels. */
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
      document.querySelectorAll<HTMLElement>('[data-testid="source-menu"] [data-list-item]'),
    )) {
      // Each part of a row has its own test id: `source-name-<rest>` for `source-entry-<rest>`.
      const rest = (item.getAttribute('data-testid') ?? '').replace(/^source-/, '');
      const name = document.querySelector<HTMLElement>(`[data-testid="source-name-${rest}"]`);
      if (!name) continue;
      const badge = document.querySelector<HTMLElement>(`[data-testid="source-badge-${rest}"]`);
      const sub = document.querySelector<HTMLElement>(`[data-testid="source-sub-${rest}"]`);
      const row = item.closest('[data-list-row]');
      out.push({
        testId: item.getAttribute('data-testid') ?? '',
        label: item.getAttribute('aria-label') ?? '',
        nameText: name.textContent ?? '',
        twoLine: sub !== null,
        item: box(item)!,
        name: box(name)!,
        badge: box(badge),
        badgeText: badge?.textContent ?? null,
        sub: box(sub),
        actions: box(row?.querySelector('[data-row-action]')?.parentElement ?? null),
        nameScroll: name.scrollWidth,
        nameClient: name.clientWidth,
        hasTitle: (item.getAttribute('title') ?? '').includes(name.textContent ?? '\u0000'),
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
    await resizeTo(1440, 900);
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
      const realRow = rows.find((r) => r.nameText === REAL)!;
      expect(realRow.nameScroll, `${where}: ${REAL} must not be truncated`).toBeLessThanOrEqual(
        realRow.nameClient + 1,
      );
      const n60 = rows.find((r) => r.nameText === N60)!;
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

  // Work 009 T9 (ruling 0198): the row stays 44px. The actions are centred vertically in the badge
  // column, and while they show the badge fades out: they replace it and never cover a visible one.
  it('hover actions replace the badge: the badge fades, the actions are centred in its column', async () => {
    const real = await resize(1180);
    await openSourceMenu();
    const id = (await (await entryByName(N60)).getAttribute('data-testid'))!;
    await revealRowActions(id);
    const badgeId = `source-badge-${id.replace(/^source-/, '')}`;
    await browser.waitUntil(
      async () =>
        browser.execute(
          (t) => getComputedStyle(document.querySelector(`[data-testid="${t}"]`)!).opacity === '0',
          badgeId,
        ),
      { timeoutMsg: `the badge of ${id} did not fade while its actions show` },
    );
    await waitForActionsSettled(id);
    const row = (await measureRows()).find((r) => r.testId === id)!;
    const a = row.actions!;
    const b = row.badge!;
    const item = row.item;
    const buttons = await browser.execute((t) => {
      const actions = document
        .querySelector(`[data-testid="${t}"]`)
        ?.closest('[data-list-row]')
        ?.querySelector<HTMLElement>('[data-row-action]')?.parentElement;
      return Array.from(actions?.querySelectorAll<HTMLElement>('button') ?? []).map((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
    }, id);
    expect(close(item.height, 44), `row height ${item.height} (the row stays 44px)`).toBe(true);
    expect(a.width, 'the actions are shown').toBeGreaterThan(0);
    expect(
      close(a.left + a.width / 2, b.left + b.width / 2),
      'actions centred on the badge column',
    ).toBe(true);
    expect(
      close((a.top + a.bottom) / 2, (item.top + item.bottom) / 2),
      `actions centred on the row (${a.top}-${a.bottom} in ${item.top}-${item.bottom})`,
    ).toBe(true);
    expect(
      a.left >= b.left - TOL && a.right <= b.right + TOL,
      'actions inside the badge column',
    ).toBe(true);
    expect(a.top >= item.top && a.bottom <= item.bottom, 'actions inside the row').toBe(true);
    expect(buttons.length, 'Edit and Forget').toBe(2);
    for (const size of buttons) {
      expect(
        close(size.width, 24) && close(size.height, 24),
        `action ${size.width}x${size.height}`,
      ).toBe(true);
    }
    await shot(`hover-actions-replace-badge-${real}-long-name`);
    await closeSourceMenu();
  });

  it('status circles differ by more than colour: connected, idle, absent and failed', async () => {
    await openSourceMenu();
    const idle = await glyph('[data-testid="source-status-entry-vis-fail"]');
    const absent = await glyph('[data-testid="source-status-entry-vis-22"]');
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
    const failed = await glyph('[data-testid="source-status-entry-vis-60"]');
    expect(failed?.content).toContain('✕');
    expect(failed?.color).not.toBe(idle?.color);
    await shot(`failed-row-${w1180}-long-name`);
    await closeSourceMenu();

    // connected: the green token with a halo, nothing else looks like it.
    await selectSource('source-entry-vis-sim');
    await waitForState('Connected');
    await openSourceMenu();
    const connected = await glyph('[data-testid="source-status-entry-vis-sim"]');
    expect(connected?.background).not.toBe(idle?.background);
    expect(connected?.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(connected?.borderWidth).toBe('0px');
    const halo = await browser.execute(
      () =>
        getComputedStyle(
          document.querySelector('[data-testid="source-status-entry-vis-sim"]')!,
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
        .querySelector('[data-testid="source-status-entry-vis-sim"]')!
        .setAttribute('data-status', 'connecting');
    });
    const g = await glyph('[data-testid="source-status-entry-vis-sim"]');
    const idle = await glyph('[data-testid="source-status-entry-vis-fail"]');
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
        // A failed connect is still Connecting… for a moment: wait for it before the next pick.
        await waitForLaunchSettled();
        await browser.waitUntil(async () => (await sourceButtonText()).includes(label), {
          timeoutMsg: `the source button never showed ${label}`,
        });
        await browser.pause(300);
        const m = await browser.execute(() => {
          const b = document.querySelector<HTMLElement>('[data-testid="source-button"]')!;
          const n = b.querySelector<HTMLElement>('[data-testid="source-button-name"]')!;
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
    const id = (await row.getAttribute('data-testid'))!.replace(/^source-/, '');
    expect(await (await byTestId(`source-status-${id}`)).getAttribute('data-status')).toBe(
      'absent',
    );
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
    await waitForGone('add-source-dialog');
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
      await waitForGone('add-source-dialog');
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
 * (`scrollWidth <= clientWidth`); with the capture control beside it at least `minChars` characters
 * must be visible; longer names must ellipsise deliberately, with the full name in the tooltip.
 */
async function assertNameVisible(where: string, name: string, minChars: number) {
  const m = await browser.execute(() => {
    const btn = document.querySelector('[data-testid="source-button"]')!;
    const el = btn.querySelector('[data-testid="source-button-name"]')!;
    return {
      sw: el.scrollWidth,
      cw: el.clientWidth,
      title: btn.getAttribute('title') ?? '',
      aria: btn.getAttribute('aria-label') ?? '',
    };
  });
  const center = await browser.execute(() => {
    const el = document.querySelector<HTMLInputElement>('[data-testid="center-frequency"]')!;
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
    await resizeTo(1440, 900);
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

  it('the capture control keeps its size in both modes and its menu fits the window', async () => {
    await resize(1180);
    await ensureDisconnected();
    await closeSourceMenu();
    await selectSource(SIM_ID);
    await waitForState('Connected');
    const capture = () =>
      browser.execute(() => {
        const r = document.querySelector('.split-button')!.getBoundingClientRect();
        return { w: r.width, h: r.height, right: r.right };
      });
    for (const w of FIT_WIDTHS) {
      const real = await resize(w);
      await chooseMode('continuous');
      await browser.pause(300);
      const continuous = await capture();
      await assertChromeFits(`continuous capture control at ${real}`);
      await shot(`capture-continuous-idle-${real}`);

      await chooseMode('single');
      await browser.pause(300);
      const single = await capture();
      expect(
        Math.abs(single.w - continuous.w) <= TOL,
        `capture control width changed at ${real}`,
      ).toBe(true);
      expect(
        Math.abs(single.h - continuous.h) <= TOL,
        `capture control height changed at ${real}`,
      ).toBe(true);
      await assertChromeFits(`single capture control at ${real}`);
      await shot(`capture-single-idle-${real}`);

      await (await byTestId('capture-mode-button')).click();
      await byTestId('capture-mode-menu').waitForDisplayed();
      const menu = await browser.execute(() => {
        const r = document
          .querySelector('[data-testid="capture-mode-menu"]')!
          .getBoundingClientRect();
        return { left: r.left, right: r.right, iw: window.innerWidth };
      });
      expect(menu.left, `capture menu starts left of the window at ${real}`).toBeGreaterThanOrEqual(
        0,
      );
      expect(menu.right, `capture menu ends past the window at ${real}`).toBeLessThanOrEqual(
        menu.iw + 0.5,
      );
      await assertNoOverflow('[data-testid="capture-mode-menu"]');
      await shot(`capture-menu-open-${real}`);
      await browser.keys(['Escape']);
      await waitForGone('capture-mode-menu');
    }
    await chooseMode('continuous');
    await ensureDisconnected();
  });

  // Connected and acquiring: the simulator entry renamed to the name under test.
  for (const name of [N22_SIM, longSim]) {
    it(`connected and acquiring with a ${name.length}-char name`, async () => {
      await resize(1180);
      await ensureDisconnected();
      await openEditDialog(SIM_ID);
      await fillDialog({ name });
      await (await byTestId('add-source-save')).click();
      await waitForGone('add-source-dialog');
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
  it('shows the real device name in full while connected and acquiring', async () => {
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
    await waitForGone('add-source-dialog');
  });
});

// States the simulator cannot reach on its own. This block runs last: an injected status is
// newer than the backend's, so the UI would drop the backend's later statuses. Any injected status
// with a source also clears the frame store (the UI treats it as a source switch), so every shot
// here is a state without a frame; `connecting` is injected last of all.
describe('Visual guard: injected states (waiting, single capture, warning, lost device, connecting)', () => {
  after(async () => {
    await resizeTo(1440, 900);
  });

  it('setup: a connected simulator', async () => {
    await resize(1440);
    await simulatorLive();
    await pauseAcquisition();
  });

  for (const w of WIDE) {
    it(`waiting plot tag while acquiring without a frame at ${w}px`, async () => {
      const real = await resize(w);
      await injectStatus({ state: 'acquiring', captureMode: 'continuous', lastNotice: null });
      await browser.waitUntil(async () => (await livenessKind()) === 'waiting', {
        timeoutMsg: 'the plot tag did not show the waiting state',
      });
      await shot(`plot-tag-waiting-${real}`);
    });

    it(`single capture in progress at ${w}px`, async () => {
      const real = await resize(w);
      await injectStatus({ state: 'acquiring', captureMode: 'single', lastNotice: null });
      await browser.waitUntil(async () => (await livenessKind()) === 'capturing', {
        timeoutMsg: 'the plot tag did not show CAPTURING',
      });
      await shot(`capture-single-capturing-${real}`);
    });

    it(`warning banner (acquisition failed) at ${w}px`, async () => {
      const real = await resize(w);
      await injectStatus({
        state: 'connected',
        captureMode: 'continuous',
        lastNotice: {
          kind: 'acquisitionFailed',
          message: 'Acquisition stopped: the source returned no data.',
          timestampMs: Date.now(),
        },
      });
      await (await byTestId('session-notice')).waitForDisplayed();
      await shot(`banner-warning-${real}`);
    });

    it(`lost device banner with Reconnect at ${w}px`, async () => {
      const real = await resize(w);
      await injectStatus({
        state: 'disconnected',
        source: null,
        captureMode: 'continuous',
        lastNotice: {
          kind: 'deviceLost',
          message: 'Signal simulator was unplugged.',
          timestampMs: Date.now(),
        },
      });
      await (await byTestId('reconnect-button')).waitForDisplayed();
      await shot(`banner-device-lost-${real}`);
    });
  }

  it('status bar while connecting (injected last: it clears the frame store)', async () => {
    for (const w of STATE_WIDTHS) {
      const real = await resize(w);
      await injectStatus({ state: 'connecting', captureMode: 'continuous', lastNotice: null });
      await shot(`statusbar-connecting-${real}`);
    }
  });
});

// The mismatch state (a different SA430 answering on the stored port) needs a second analyzer;
// it cannot be faked in the real app, so it is reported as skipped rather than mocked.
describe.skip('Visual guard: mismatch state (needs two SA430 analyzers)', () => {
  it('shows the Different device warning', () => undefined);
});
