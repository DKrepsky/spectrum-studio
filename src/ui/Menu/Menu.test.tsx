import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';

import { cssRules } from '../../test/css';
import { Menu } from './Menu';
import { MenuItemRadio } from './MenuItemRadio';

interface HarnessProps {
  checked?: string;
  onChoose?: (name: string) => void;
  onClose?: (refocus: boolean) => void;
}

function Harness({
  checked = 'Continuous',
  onChoose = () => undefined,
  onClose = () => undefined,
}: HarnessProps) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button ref={anchor}>trigger</button>
      <button>outside</button>
      {open && (
        <Menu
          label="Capture mode"
          heading="Capture mode"
          anchorRef={anchor}
          onClose={(refocus) => {
            onClose(refocus);
            setOpen(false);
          }}
        >
          {['Continuous', 'Single', 'Sweeps'].map((name) => (
            <MenuItemRadio
              key={name}
              name={name}
              description={`${name} description`}
              checked={checked === name}
              onSelect={() => onChoose(name)}
              testId={`item-${name}`}
            />
          ))}
        </Menu>
      )}
    </>
  );
}

const css = readFileSync(resolve(__dirname, 'Menu.css'), 'utf8');

describe('Menu', () => {
  it('keeps the icon column of an item without an icon: the cell is there and empty, not hidden', () => {
    render(
      <Menu label="Capture mode" anchorRef={{ current: null }} onClose={() => undefined}>
        <MenuItemRadio
          name="Continuous"
          description="Frames until stopped"
          checked
          onSelect={() => undefined}
        />
        <MenuItemRadio name="Single" checked={false} onSelect={() => undefined} />
      </Menu>,
    );
    const item = screen.getByRole('menuitemradio', { name: 'Single' });
    const cell = item.querySelector('.menu-item-icon');
    expect(cell).toBeInTheDocument();
    expect(cell).toBeEmptyDOMElement();
    expect(item.querySelector('.menu-item-name')).toHaveTextContent('Single');
  });

  it('never hides the icon column with CSS (the track must stay for items without an icon)', () => {
    const hidden = cssRules(css).filter(
      (r) => /menu-item-icon/.test(r.selector) && /display:\s*none/.test(r.body),
    );
    expect(hidden).toEqual([]);
    const planted = cssRules('.menu-item-icon:empty { display: none; }');
    expect(planted.some((r) => /display:\s*none/.test(r.body))).toBe(true);
  });

  it('is a menu with a radio item per choice, the current one checked and named by its text', () => {
    render(<Harness checked="Single" />);
    expect(screen.getByRole('menu', { name: 'Capture mode' })).toBeInTheDocument();
    const single = screen.getByRole('menuitemradio', { name: 'Single' });
    expect(single).toHaveAttribute('aria-checked', 'true');
    expect(single).toHaveAccessibleDescription('Single description');
    expect(screen.getByRole('menuitemradio', { name: 'Continuous' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('focuses the checked item on open', () => {
    render(<Harness checked="Single" />);
    expect(screen.getByRole('menuitemradio', { name: 'Single' })).toHaveFocus();
  });

  it('focuses the first item on open when none is checked', () => {
    render(<Harness checked="none" />);
    expect(screen.getByRole('menuitemradio', { name: 'Continuous' })).toHaveFocus();
  });

  it('moves with Up and Down, wrapping at both ends', async () => {
    render(<Harness />);
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemradio', { name: 'Sweeps' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Continuous' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Single' })).toHaveFocus();
  });

  it('goes to the first and last item with Home and End', async () => {
    render(<Harness />);
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitemradio', { name: 'Sweeps' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitemradio', { name: 'Continuous' })).toHaveFocus();
  });

  it('selects by type-ahead: the typed letters move to the item that starts with them', async () => {
    render(<Harness />);
    await userEvent.keyboard('s');
    expect(screen.getByRole('menuitemradio', { name: 'Single' })).toHaveFocus();
    // A repeated letter after the type-ahead pause cycles to the next item starting with it.
    await new Promise((resolve) => setTimeout(resolve, 750));
    await userEvent.keyboard('s');
    expect(screen.getByRole('menuitemradio', { name: 'Sweeps' })).toHaveFocus();
  });

  it('chooses an item on Enter without closing the choice logic in the menu itself', async () => {
    const onChoose = vi.fn();
    render(<Harness onChoose={onChoose} />);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChoose).toHaveBeenCalledWith('Single');
  });

  it('closes on Escape and asks for a refocus', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Tab and asks for a refocus, so focus continues from the trigger', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.tab();
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('closes without refocus on a press outside, and not on a press on the trigger', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'trigger' }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
