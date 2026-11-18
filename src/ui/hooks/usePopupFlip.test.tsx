import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Menu } from '../Menu';
import { MenuItemRadio } from '../Menu/MenuItemRadio';
import { Popover } from '../Popover';
import { shouldFlipUp } from './usePopupFlip';

const WINDOW = { top: 0, bottom: 768 };
const POPUP = 133;

describe('shouldFlipUp', () => {
  it('keeps the popup below when it fits in the box', () => {
    expect(shouldFlipUp({ top: 300, bottom: 330 }, POPUP, WINDOW)).toBe(false);
  });

  it('flips above when it leaves the box below and fits above', () => {
    // 615 + 4 + 133 = 752 is inside 768; 680 + 4 + 133 = 817 is not, and 680 - 4 - 133 = 543 fits.
    expect(shouldFlipUp({ top: 650, bottom: 680 }, POPUP, WINDOW)).toBe(true);
  });

  it('stays below when it fits neither way (the old placement, no worse than before)', () => {
    expect(shouldFlipUp({ top: 20, bottom: 50 }, 900, WINDOW)).toBe(false);
  });

  it('uses the box that clips the popup, not only the window (the side panel)', () => {
    const panel = { top: 60, bottom: 600 };
    // Fits in the 768px window below (530 + 4 + 133 = 667) but not in the panel.
    expect(shouldFlipUp({ top: 500, bottom: 530 }, POPUP, WINDOW)).toBe(false);
    expect(shouldFlipUp({ top: 500, bottom: 530 }, POPUP, panel)).toBe(true);
  });
});

/**
 * Gives the named elements fixed viewport rectangles (`data-rect`, else the text). Any other element
 * is POPUP px tall at the top, the popup's own size (jsdom has no layout).
 */
function mockRects(rects: Record<string, { top: number; bottom: number }>) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const key = this.dataset.rect ? this.dataset.rect : this.textContent;
    const r = rects[key] ?? { top: 0, bottom: POPUP };
    return {
      ...r,
      left: 0,
      right: 0,
      width: 0,
      height: r.bottom - r.top,
      x: 0,
      y: r.top,
      toJSON: () => ({}),
    };
  });
}

function MenuAt({ trigger }: { trigger: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchor} data-rect={trigger}>
        trigger
      </button>
      <Menu label="Capture mode" anchorRef={anchor} onClose={() => undefined} testId="menu">
        <MenuItemRadio name="Continuous" description="d" checked onSelect={() => undefined} />
        <MenuItemRadio name="Single" description="d" checked={false} onSelect={() => undefined} />
      </Menu>
    </div>
  );
}

function PopoverAt({ trigger }: { trigger: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchor} data-rect={trigger}>
        trigger
      </button>
      <Popover label="Sources" anchorRef={anchor} onClose={() => undefined} testId="popover">
        <button data-list-item>row</button>
      </Popover>
    </div>
  );
}

describe('popups flip above their trigger when there is no room below', () => {
  let innerHeight: number;
  beforeEach(() => {
    innerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
  });

  it('a menu near the bottom of the window opens with .popover-up', () => {
    mockRects({ near: { top: 650, bottom: 680 } });
    render(<MenuAt trigger="near" />);
    expect(screen.getByTestId('menu')).toHaveClass('popover-up');
  });

  it('a menu with room below stays below', () => {
    mockRects({ high: { top: 300, bottom: 330 } });
    render(<MenuAt trigger="high" />);
    expect(screen.getByTestId('menu')).not.toHaveClass('popover-up');
  });

  it('a menu is kept inside the scrolling panel that clips it, not only the window', () => {
    mockRects({
      panelTrigger: { top: 500, bottom: 530 },
      panel: { top: 60, bottom: 600 },
    });
    render(
      <div data-rect="panel" style={{ overflowY: 'auto' }}>
        <MenuAt trigger="panelTrigger" />
      </div>,
    );
    expect(screen.getByTestId('menu')).toHaveClass('popover-up');
  });

  it('a source popover near the bottom flips the same way, and its items keep focus', () => {
    mockRects({ near: { top: 650, bottom: 680 } });
    render(<PopoverAt trigger="near" />);
    const popover = screen.getByTestId('popover');
    expect(popover).toHaveClass('popover-up');
    expect(screen.getByRole('button', { name: 'row' })).toHaveFocus();
  });
});
