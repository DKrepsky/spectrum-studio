/**
 * Source menu row polish (work 002): the row layout, the hover/focus reveal of the Edit and Forget
 * buttons, and the keyboard route into them. Seeded with the visual fixture (long names, a failing
 * simulator, a remembered simulator). Screenshots go to `SPECTRUM_E2E_SHOTS` or `e2e/logs/visual`.
 */
import { $, browser } from '@wdio/globals';

import {
  byTestId,
  closeSourceMenu,
  ensureWindowFocus,
  openSourceMenu,
  requireWmctrl,
  shot,
  waitForAppReady,
  waitForGone,
} from './helpers';

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
  /** Badge (line 1, third column) and name (line 1). */
  badgeTop: number | null;
  badgeBottom: number | null;
  badgeCx: number | null;
  badgeCy: number | null;
  nameCy: number;
  badgeOpacity: string | null;
  /** Edit/Forget are shown: opacity 1 and clickable. */
  revealed: boolean;
  actionsOpacity: string | null;
  actionsPointer: string | null;
  actionsTop: number | null;
  actionsBottom: number | null;
  actionsCx: number | null;
  actionsLeft: number | null;
  buttonCys: number[];
  buttonSizes: { width: number; height: number }[];
  nameRight: number;
  nameScroll: number;
  nameClient: number;
  /** The visible name alone (the accessible label also carries the status word). */
  nameText: string;
  title: string | null;
  focusWithin: boolean;
}

/** The test id of one part of a row: `source-entry-x` has `source-badge-entry-x`, and so on. */
const part = (testId: string, name: string) => `source-${name}-${testId.replace(/^source-/, '')}`;

async function metrics(testId: string): Promise<Metrics> {
  return browser.execute(
    (id, parts) => {
      const item = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      const row = item.closest<HTMLElement>('[data-list-row]');
      const edit = row?.querySelector<HTMLElement>('[data-row-action]') ?? null;
      // The actions are the wrapper of the row's action buttons (centred in the badge column).
      const actions = edit?.parentElement ?? null;
      const badge = document.querySelector<HTMLElement>(`[data-testid="${parts.badge}"]`);
      const name = document.querySelector<HTMLElement>(`[data-testid="${parts.name}"]`)!;
      const ir = item.getBoundingClientRect();
      const cy = (r: DOMRect) => (r.top + r.bottom) / 2;
      const cx = (r: DOMRect) => (r.left + r.right) / 2;
      const buttons = actions ? Array.from(actions.querySelectorAll<HTMLElement>('button')) : [];
      const ar = actions?.getBoundingClientRect() ?? null;
      const as = actions ? getComputedStyle(actions) : null;
      const br = badge?.getBoundingClientRect() ?? null;
      return {
        label: item.getAttribute('aria-label') ?? '',
        itemTop: ir.top,
        itemBottom: ir.bottom,
        badgeTop: br ? br.top : null,
        badgeBottom: br ? br.bottom : null,
        badgeCx: br ? cx(br) : null,
        badgeCy: br ? cy(br) : null,
        nameCy: cy(name.getBoundingClientRect()),
        badgeOpacity: badge ? getComputedStyle(badge).opacity : null,
        revealed: as !== null && as.opacity === '1' && as.pointerEvents === 'auto',
        actionsOpacity: as ? as.opacity : null,
        actionsPointer: as ? as.pointerEvents : null,
        actionsTop: ar ? ar.top : null,
        actionsBottom: ar ? ar.bottom : null,
        actionsCx: ar ? cx(ar) : null,
        actionsLeft: ar ? ar.left : null,
        buttonCys: buttons.map((b) => cy(b.getBoundingClientRect())),
        buttonSizes: buttons.map((b) => {
          const r = b.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }),
        nameRight: name.getBoundingClientRect().right,
        nameScroll: name.scrollWidth,
        nameClient: name.clientWidth,
        nameText: name.textContent ?? '',
        title: item.getAttribute('title'),
        focusWithin: actions ? actions.matches(':focus-within') : false,
      };
    },
    testId,
    { badge: part(testId, 'badge'), name: part(testId, 'name') },
  );
}

/** Moves the pointer off every row (onto the top-left corner of the page, the brand). */
async function parkPointer() {
  await (await $('body')).moveTo({ xOffset: 2, yOffset: 2 });
}

/**
 * The row actions sit in the badge column, centred vertically on the row (DESIGN.md 4.11): centred
 * on the badge column, centred on the row's height, inside the row, 24 x 24 buttons aligned with
 * each other. While they show, the badge is faded (checked by the callers), so they never cover a
 * visible badge.
 */
function assertInBadgeColumn(m: Metrics, where: string) {
  check(m.actionsTop !== null && m.badgeCx !== null, `${where}: no actions or badge`);
  check(
    Math.abs(m.actionsCx! - m.badgeCx!) <= TOL,
    `${where}: actions not centred on the badge column (${m.actionsCx} vs ${m.badgeCx})`,
  );
  const rowCy = (m.itemTop + m.itemBottom) / 2;
  const actionsCy = (m.actionsTop! + m.actionsBottom!) / 2;
  check(
    Math.abs(actionsCy - rowCy) <= TOL,
    `${where}: actions not centred on the row (${actionsCy} vs ${rowCy})`,
  );
  check(
    m.actionsTop! >= m.itemTop && m.actionsBottom! <= m.itemBottom - 1,
    `${where}: actions overflow the row`,
  );
  for (const cy of m.buttonCys) {
    check(Math.abs(cy - m.buttonCys[0]!) <= TOL, `${where}: buttons misaligned (${m.buttonCys})`);
  }
  for (const size of m.buttonSizes) {
    check(
      Math.abs(size.width - 24) <= TOL && Math.abs(size.height - 24) <= TOL,
      `${where}: a row action is ${size.width}x${size.height}, not 24x24`,
    );
  }
}

/** The badge is centred on the whole row (both lines), as before 009 (DESIGN.md 4.11). */
function assertBadgeCentredOnRow(m: Metrics, where: string) {
  const rowCy = (m.itemTop + m.itemBottom) / 2;
  check(
    Math.abs(m.badgeCy! - rowCy) <= TOL,
    `${where}: badge not centred on the row (${m.badgeCy} vs ${rowCy})`,
  );
}

/** Focuses a row by its test id (script focus, so the pointer state does not matter). */
async function focusRow(testId: string) {
  await browser.execute((id) => {
    (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).focus();
  }, testId);
}

describe('source menu row polish (seeded visual fixture)', () => {
  before(async () => {
    requireWmctrl(); // the focus tests below raise the window; fail here, not in the middle of one
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
        document.querySelectorAll<HTMLElement>(
          '[data-testid="source-menu"] [data-list-row]:has([data-row-action])',
        ),
      ).map((r) => {
        const s = getComputedStyle(
          r.querySelector<HTMLElement>('[data-row-action]')!.parentElement!,
        );
        const b = r.querySelector<HTMLElement>('[data-testid^="source-badge-"]');
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
      const row = el.closest('[data-list-row]');
      const a = row?.querySelector<HTMLElement>('[data-row-action]')?.parentElement;
      const b = row?.querySelector<HTMLElement>('[data-testid^="source-badge-"]');
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
    // :focus-within needs OS focus for the window (see ensureWindowFocus).
    await ensureWindowFocus();
    await parkPointer();
    await browser.pause(200);
    await focusRow(VIS_22);
    await browser.pause(200);
    await browser.keys(['ArrowRight']);
    await browser.pause(300);
    const after = await browser.execute(() => ({
      testid: document.activeElement?.getAttribute('data-testid') ?? null,
      menuAction: document.activeElement?.getAttribute('data-row-action') ?? null,
    }));
    check(after.menuAction === 'edit', `ArrowRight did not reach Edit: ${JSON.stringify(after)}`);
    // Focus is inside the actions: they stay revealed and the badge fades, with the pointer away.
    // The window may have lost OS focus since the first call (another window raised): raise it again,
    // then wait for the reveal transition (150 ms) to finish before reading the opacity.
    await ensureWindowFocus();
    await browser.waitUntil(async () => (await metrics(VIS_22)).revealed, {
      timeout: 2000,
      timeoutMsg: 'the row actions did not reveal while Edit has focus',
    });
    const focused = await metrics(VIS_22);
    check(focused.focusWithin, 'Edit is not focus-within its row (the window has OS focus)');
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
      () =>
        getComputedStyle(document.querySelector('[data-row-action]')!.parentElement!).transition,
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
    assertInBadgeColumn(m, 'two-line hover');
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

  it('rows are 44px with a 3px gap: two-line rows are 47px apart', async () => {
    const pitches = await browser.execute(() => {
      // Consecutive rows of one list only (a group heading sits between two lists). Each row sits in its own li.
      const rows = [
        ...document.querySelectorAll<HTMLElement>('[data-list-row][data-size="two-line"]'),
      ];
      const out: number[][] = [];
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]!;
        const cur = rows[i]!;
        if (prev.closest('ul') !== cur.closest('ul')) continue;
        out.push([
          cur.getBoundingClientRect().top - prev.getBoundingClientRect().top,
          prev.getBoundingClientRect().height,
        ]);
      }
      return out;
    });
    check(pitches.length >= 2, `fewer than two consecutive two-line rows: ${pitches.length}`);
    for (const [pitch, height] of pitches) {
      check(Math.abs(pitch! - 47) <= TOL, `row pitch ${pitch} (expected 47)`);
      check(Math.abs(height! - 44) <= TOL, `row height ${height} (expected 44)`);
    }
  });

  it('remembered simulator: badge centred at rest, buttons centred on hover', async () => {
    const rest = await metrics(VIS_SIM);
    assertBadgeCentredOnRow(rest, 'rest');
    await shot('rest-two-line-{w}-visual');
    await (await byTestId(VIS_SIM)).moveTo();
    await browser.pause(350);
    const m = await metrics(VIS_SIM);
    check(m.revealed, 'hovered simulator buttons not revealed');
    assertInBadgeColumn(m, 'simulator hover');
    await shot('hover-simulator-{w}-visual');
    await parkPointer();
  });

  it('long name row: ellipsis with title, buttons centred and clear of the name', async () => {
    await (await byTestId(VIS_60)).moveTo();
    await browser.pause(350);
    const m = await metrics(VIS_60);
    check(m.nameScroll > m.nameClient, 'long name is not ellipsised');
    check((m.title ?? '').includes(m.nameText), 'no full-name tooltip on the long row');
    check(m.revealed, 'long-name row buttons not revealed on hover');
    assertInBadgeColumn(m, 'long-name hover');
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
      () => document.activeElement?.getAttribute('data-row-action') ?? null,
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
    await waitForGone('add-source-dialog');
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
    assertInBadgeColumn(m, 'narrow long-name hover');
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
