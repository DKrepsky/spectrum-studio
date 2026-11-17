import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type SyntheticEvent } from 'react';

import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';
import { FieldGroup } from './FieldGroup';

interface HarnessProps {
  dismissable?: boolean;
  onClose?: () => void;
  onSubmit?: (e: SyntheticEvent<HTMLFormElement>) => void;
  useInitial?: boolean;
}

function Harness({ dismissable, onClose = () => undefined, onSubmit, useInitial }: HarnessProps) {
  const opener = useRef<HTMLButtonElement>(null);
  const second = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button ref={opener} onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <Dialog
          title="Add source"
          dismissable={dismissable}
          returnFocusTo={opener}
          initialFocus={useInitial ? second : undefined}
          onSubmit={onSubmit}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <FieldGroup legend="Connection">
            <input aria-label="Name" />
            <input ref={second} aria-label="Port" />
          </FieldGroup>
          <DialogFooter start={<button>Forget</button>}>
            <button onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit">Save</button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  );
}

describe('Dialog', () => {
  it('is a modal dialog named by its title, rendered in the body', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Add source' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.closest('.dialog-backdrop')?.parentElement).toBe(document.body);
  });

  it('focuses the first control on open', () => {
    render(<Harness />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('focuses the given control on open', () => {
    render(<Harness useInitial />);
    expect(screen.getByRole('textbox', { name: 'Port' })).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside the dialog, cycling at both ends', async () => {
    render(<Harness />);
    const first = screen.getByRole('textbox', { name: 'Name' });
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    await userEvent.tab();
    expect(first).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  it('calls onClose on Escape, and not while it is not dismissable', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Harness onClose={onClose} dismissable={false} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    unmount();

    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a press on the backdrop', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(document.querySelector<HTMLElement>('.dialog-backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns focus to the opener when it closes', async () => {
    render(<Harness />);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'open' })).toHaveFocus();
  });

  it('submits on Enter in a field through onSubmit, and prevents the browser submit by default', async () => {
    const onSubmit = vi.fn((e: SyntheticEvent<HTMLFormElement>) => e.preventDefault());
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders the footer with the destructive action at the start and the rest at the end', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Forget' }).parentElement).toHaveClass(
      'dialog-footer-start',
    );
    expect(screen.getByRole('button', { name: 'Save' }).parentElement).toHaveClass(
      'dialog-footer-end',
    );
  });

  it('names a field group by its legend', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Connection' }).tagName).toBe('FIELDSET');
  });
});
