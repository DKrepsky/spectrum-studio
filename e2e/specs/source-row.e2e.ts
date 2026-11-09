/**
 * Source menu row polish (work 002): the row layout, the hover/focus reveal of the Edit and Forget
 * buttons, and the keyboard route into them. Seeded with the visual fixture (long names, a failing
 * simulator, a remembered simulator). Screenshots go to `SPECTRUM_E2E_SHOTS` or `e2e/logs/visual`.
 */
import { $, browser } from '@wdio/globals';

import { byTestId, closeSourceMenu, openSourceMenu, shot, waitForAppReady } from './helpers';

const VIS_22 = 'source-entry-vis-22';
const VIS_60 = 'source-entry-vis-60';
const VIS_REAL = 'source-entry-vis-real';
const VIS_SIM = 'source-entry-vis-sim';
const TOL = 1.5;

/** Throws with a message when the condition does not hold (wdio expect takes no message). */
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

interface Metrics {
  label: string;
  itemTop: number;
  itemBottom: number;
  badgeCy: number | null;
  badgeOpacity: string | null;
  /** Edit/Forget are shown: opacity 1 and clickable. */
  revealed: boolean;
  actionsOpacity: string | null;
  actionsPointer: string | null;
  actionsCy: number | null;
  actionsLeft: number | null;
  buttonCys: number[];
  nameRight: number;
  nameScroll: number;
  nameClient: number;
  title: string | null;
  focusWithin: boolean;
}

async function metrics(testId: string): Promise<Metrics> {
  return browser.execute((id) => {
    const item = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const row = item.closest<HTMLElement>('.source-row');
    const actions = row?.querySelector<HTMLElement>('.source-actions') ?? null;
    const badge = item.querySelector<HTMLElement>('.src-badge');
    const name = item.querySelector<HTMLElement>('.src-name')!;
    const ir = item.getBoundingClientRect();
    const cy = (r: DOMRect) => (r.top + r.bottom) / 2;
    const buttons = actions ? Array.from(actions.querySelectorAll<HTMLElement>('button')) : [];
    const ar = actions?.getBoundingClientRect() ?? null;
    const as = actions ? getComputedStyle(actions) : null;
    return {
      label: item.dataset['label'] ?? '',
      itemTop: ir.top,
      itemBottom: ir.bottom,
      badgeCy: badge ? cy(badge.getBoundingClientRect()) : null,
      badgeOpacity: badge ? getComputedStyle(badge).opacity : null,
      revealed: as !== null && as.opacity === '1' && as.pointerEvents === 'auto',
      actionsOpacity: as ? as.opacity : null,
      actionsPointer: as ? as.pointerEvents : null,
      actionsCy: ar ? cy(ar) : null,
      actionsLeft: ar ? ar.left : null,
      buttonCys: buttons.map((b) => cy(b.getBoundingClientRect())),
      nameRight: name.getBoundingClientRect().right,
      nameScroll: name.scrollWidth,
      nameClient: name.clientWidth,
      title: item.getAttribute('title'),
      focusWithin: actions ? actions.matches(':focus-within') : false,
    };
  }, testId);
}

/** Moves the pointer off every row (onto the top-left corner of the page, the toolbar). */
async function parkPointer() {
  await (await $('body')).moveTo({ xOffset: 2, yOffset: 2 });
}

/** Asserts that a row's buttons sit centred in the row and aligned with each other. */
function assertCentred(m: Metrics, where: string) {
  check(m.actionsCy !== null, `${where}: no actions`);
  check(
    Math.abs(m.actionsCy! - (m.itemTop + m.itemBottom) / 2) <= TOL,
    `${where}: actions not centred (${m.actionsCy} vs ${(m.itemTop + m.itemBottom) / 2})`,
  );
  for (const cy of m.buttonCys) {
    check(Math.abs(cy - m.actionsCy!) <= TOL, `${where}: a button is not centred`);
  }
  if (m.buttonCys.length > 1) {
    check(
      Math.abs(m.buttonCys[0]! - m.buttonCys[1]!) <= TOL,
      `${where}: buttons misaligned (${m.buttonCys})`,
    );
  }
}

/** Focuses a row by its test id (script focus, so the pointer state does not matter). */
async function focusRow(testId: string) {
  await browser.execute((id) => {
    (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).focus();
  }, testId);
}

describe('source menu row polish (seeded visual fixture)', () => {
  before(async () => {
    await browser.setWindowSize(1180, 820);
    await browser.pause(250);
    await waitForAppReady();
  });

  it('menu just opened: no edit/forget buttons revealed, badges shown', async () => {
    await openSourceMenu();
    await parkPointer();
    await browser.pause(300);
    const rows = await browser.execute(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="source-menu"] .source-row'),
      ).map((r) => {
        const s = getComputedStyle(r.querySelector<HTMLElement>('.source-actions')!);
        const b = r.querySelector<HTMLElement>('.src-badge');
        return {
          opacity: s.opacity,
          pe: s.pointerEvents,
          badge: b ? getComputedStyle(b).opacity : null,
        };
      }),
    );
    check(rows.length >= 5, `expected the seeded rows, found ${rows.length}`);
    for (const r of rows) {
      check(
        r.opacity === '0' && r.pe === 'none' && r.badge === '1',
        `row state at open: ${JSON.stringify(r)}`,
      );
    }
    await shot('menu-open-{w}-visual');
  });

  it('keyboard focus on a row (ArrowDown) keeps its buttons hidden and shows the badge', async () => {
    await browser.keys(['ArrowDown']);
    await browser.keys(['ArrowDown']);
    await browser.pause(300);
    const focused = await browser.execute(() => {
      const el = document.activeElement as HTMLElement;
      const row = el.closest('.source-row');
      const a = row?.querySelector<HTMLElement>('.source-actions');
      const b = row?.querySelector<HTMLElement>('.src-badge');
      return {
        opacity: a ? getComputedStyle(a).opacity : null,
        badge: b ? getComputedStyle(b).opacity : null,
      };
    });
    check(
      focused.opacity === '0',
      `keyboard-focused row shows its buttons: ${JSON.stringify(focused)}`,
    );
    check(focused.badge === '1', `keyboard-focused badge not shown: ${JSON.stringify(focused)}`);
    await shot('focus-keyboard-{w}-visual');
    await browser.keys(['ArrowUp']);
    await browser.keys(['ArrowUp']);
  });

  it('ArrowRight from a row with the pointer away moves focus to its Edit button', async () => {
    await parkPointer();
    await browser.pause(200);
    await focusRow(VIS_22);
    await browser.pause(200);
    await browser.keys(['ArrowRight']);
    await browser.pause(300);
    const after = await browser.execute(() => ({
      testid: document.activeElement?.getAttribute('data-testid') ?? null,
      menuAction: document.activeElement?.getAttribute('data-menu-action') ?? null,
    }));
    check(after.menuAction === 'edit', `ArrowRight did not reach Edit: ${JSON.stringify(after)}`);
    // Focus is inside the actions: they stay revealed and the badge fades, with the pointer away.
    const focused = await metrics(VIS_22);
    check(focused.focusWithin, 'Edit is not focus-within its row');
    check(focused.revealed, 'row actions hidden while Edit has focus');
    check(
      focused.badgeOpacity === '0',
      `badge not faded while Edit has focus: ${focused.badgeOpacity}`,
    );
    await shot('focus-arrowright-{w}-visual');
    await browser.keys(['ArrowLeft']);
    await parkPointer();
    await browser.pause(300);
    const back = await browser.execute(
      () => document.activeElement?.getAttribute('data-testid') ?? null,
    );
    check(back === VIS_22, `ArrowLeft did not return to the row: ${back}`);
  });

  it('hover reveals the buttons with a slide from the left; badge fades; buttons centred and aligned', async () => {
    await (await byTestId(VIS_REAL)).moveTo();
    await browser.pause(400);
    const trStyle = await browser.execute(
      () => getComputedStyle(document.querySelector('.source-actions')!).transition,
    );
    check(
      trStyle.includes('opacity') &&
        trStyle.includes('transform') &&
        !trStyle.includes('visibility'),
      `unexpected actions transition: ${trStyle}`,
    );
    const m = await metrics(VIS_REAL);
    check(m.revealed, `buttons not revealed on hover: opacity ${m.actionsOpacity}`);
    check(m.badgeOpacity === '0', `badge not faded: ${m.badgeOpacity}`);
    assertCentred(m, 'two-line hover');
    check(
      m.actionsLeft! >= m.nameRight - 0.5,
      `actions overlap the name (${m.actionsLeft} < ${m.nameRight})`,
    );
    check(m.itemBottom - m.itemTop >= 43, `two-line row height ${m.itemBottom - m.itemTop}`);
    await shot('hover-two-line-{w}-visual');
  });

  it('leaving the row hides the buttons again and the badge comes back', async () => {
    await parkPointer();
    await browser.pause(400);
    const m = await metrics(VIS_REAL);
    check(!m.revealed, `buttons still revealed after leave: opacity ${m.actionsOpacity}`);
    check(m.actionsPointer === 'none', `hidden buttons still clickable: ${m.actionsPointer}`);
    check(m.badgeOpacity === '1', `badge not back after leave: ${m.badgeOpacity}`);
  });

  it('remembered simulator: badge centred at rest, buttons centred on hover', async () => {
    const rest = await metrics(VIS_SIM);
    check(
      Math.abs(rest.badgeCy! - (rest.itemTop + rest.itemBottom) / 2) <= TOL,
      `rest badge not centred: ${rest.badgeCy} vs ${(rest.itemTop + rest.itemBottom) / 2}`,
    );
    await shot('rest-two-line-{w}-visual');
    await (await byTestId(VIS_SIM)).moveTo();
    await browser.pause(350);
    const m = await metrics(VIS_SIM);
    check(m.revealed, 'hovered simulator buttons not revealed');
    assertCentred(m, 'simulator hover');
    await shot('hover-simulator-{w}-visual');
    await parkPointer();
  });

  it('long name row: ellipsis with title, buttons centred and clear of the name', async () => {
    await (await byTestId(VIS_60)).moveTo();
    await browser.pause(350);
    const m = await metrics(VIS_60);
    check(m.nameScroll > m.nameClient, 'long name is not ellipsised');
    check((m.title ?? '').includes(m.label), 'no full-name tooltip on the long row');
    check(m.revealed, 'long-name row buttons not revealed on hover');
    assertCentred(m, 'long-name hover');
    check(m.actionsLeft! >= m.nameRight - 0.5, 'buttons overlap the long name');
    check(m.badgeOpacity === '0', 'badge not faded on long row');
    await shot('hover-long-{w}-visual');
    await parkPointer();
  });

  it('ArrowRight while the row is hovered focuses Edit', async () => {
    await (await byTestId(VIS_22)).moveTo();
    await browser.pause(300);
    await focusRow(VIS_22);
    await browser.keys(['ArrowRight']);
    await browser.pause(200);
    const after = await browser.execute(
      () => document.activeElement?.getAttribute('data-menu-action') ?? null,
    );
    await shot('focus-arrowright-hovered-{w}-visual');
    await parkPointer();
    check(after === 'edit', `ArrowRight while hovered did not focus Edit (focus: ${after})`);
    await browser.keys(['ArrowLeft']);
  });

  it('F2 opens Edit and Delete forgets the focused row (then Undo restores it)', async () => {
    await parkPointer();
    await focusRow(VIS_22);
    await browser.keys(['F2']);
    await byTestId('add-source-dialog').waitForDisplayed();
    await browser.keys(['Escape']);
    await byTestId('add-source-dialog').waitForExist({ reverse: true });
    await openSourceMenu();
    await focusRow(VIS_22);
    await browser.keys(['Delete']);
    await byTestId('source-undo').waitForExist({ timeoutMsg: 'Delete did not forget the row' });
    await (await byTestId('source-undo')).click();
    await byTestId(VIS_22).waitForExist({ timeoutMsg: 'Undo did not restore the row' });
    await closeSourceMenu();
  });

  it('narrowest window the app allows (min 1024px): hover centred, no sideways scroll', async () => {
    await browser.setWindowSize(520, 820);
    await browser.pause(300);
    await openSourceMenu();
    await (await byTestId(VIS_60)).moveTo();
    await browser.pause(350);
    const m = await metrics(VIS_60);
    assertCentred(m, 'narrow long-name hover');
    const sideways = await browser.execute(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(sideways <= 1, `page scrolls sideways by ${sideways}`);
    await shot('hover-long-{w}-visual');
    await parkPointer();
    await closeSourceMenu();
    await browser.setWindowSize(1180, 820);
  });
});
