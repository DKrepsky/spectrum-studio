import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useRef, useState } from 'react';

import { ListRow } from './ListRow';
import { Popover } from './Popover';
import { PopoverGroup } from './PopoverGroup';

interface HarnessProps {
  current?: string;
  unavailable?: string[];
  onClose?: (refocus: boolean) => void;
}

/** A trigger button, and a popover that opens from it, as the feature code will use them. */
function Harness({ current, unavailable = [], onClose = () => undefined }: HarnessProps) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button ref={anchor} onClick={() => setOpen(true)}>
        trigger
      </button>
      <button>outside</button>
      {open && (
        <Popover
          label="Sources"
          anchorRef={anchor}
          onClose={(refocus) => {
            onClose(refocus);
            setOpen(false);
          }}
        >
          <PopoverGroup label="Your sources">
            {['Alpha', 'Bravo', 'Charlie'].map((name) => (
              <ListRow
                key={name}
                label={name}
                current={current === name}
                unavailable={unavailable.includes(name)}
                onSelect={() => undefined}
                actions={<button>Edit {name}</button>}
              >
                {name}
              </ListRow>
            ))}
          </PopoverGroup>
          <PopoverGroup label="Add a source" divided>
            <button data-list-item>Add source…</button>
          </PopoverGroup>
        </Popover>
      )}
      <button>after</button>
    </>
  );
}

describe('Popover', () => {
  it('is a non-modal dialog named by its label, with groups labelled by their headings', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Sources' });
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(screen.getByRole('group', { name: 'Your sources' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Add a source' })).toHaveClass(
      'popover-group-divided',
    );
  });

  it('focuses the current row on open', () => {
    render(<Harness current="Bravo" />);
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveFocus();
  });

  it('focuses the first row on open when no row is current', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveFocus();
  });

  it('marks the current row with aria-current and an unavailable row with aria-disabled', () => {
    render(<Harness current="Alpha" unavailable={['Charlie']} />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Bravo' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Charlie' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('does not select an unavailable row on press', async () => {
    const onSelect = vi.fn();
    render(
      <Popover label="Sources" anchorRef={createRef<HTMLElement>()} onClose={() => undefined}>
        <ListRow label="Locked" unavailable onSelect={onSelect}>
          Locked
        </ListRow>
      </Popover>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Locked' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('moves between rows with Up and Down, and Home and End', async () => {
    render(<Harness />);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Add source…' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveFocus();
  });

  it('keeps Tab inside: moving between controls does not close it', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Edit Alpha' })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without refocusing the trigger when Tab leaves past the last control', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    screen.getByRole('button', { name: 'Add source…' }).focus();
    await userEvent.tab();
    expect(onClose).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('closes without refocusing when Shift+Tab leaves before the first control', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(onClose).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'outside' })).toHaveFocus();
  });

  it('closes and asks for a refocus on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes without refocusing on a press outside, and ignores a press on the trigger', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'trigger' }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('does not close on a press inside it', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bravo' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves an Escape that a child already handled to the child', async () => {
    const onClose = vi.fn();
    render(
      <Popover label="Sources" anchorRef={createRef<HTMLElement>()} onClose={onClose}>
        <input
          aria-label="Host"
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.preventDefault();
          }}
        />
      </Popover>,
    );
    screen.getByRole('textbox', { name: 'Host' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps focus where a child put it on open (a form field), instead of the first row', () => {
    render(
      <Popover label="Sources" anchorRef={createRef<HTMLElement>()} onClose={() => undefined}>
        <ListRow label="Alpha" onSelect={() => undefined}>
          Alpha
        </ListRow>
        <input aria-label="Host" autoFocus />
      </Popover>,
    );
    expect(screen.getByRole('textbox', { name: 'Host' })).toHaveFocus();
  });
});
