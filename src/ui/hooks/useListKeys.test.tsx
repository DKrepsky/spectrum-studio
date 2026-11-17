import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';

import { useListKeys } from './useListKeys';

function List() {
  const root = useRef<HTMLDivElement>(null);
  const onKeyDown = useListKeys({ container: root });
  return (
    <div ref={root} onKeyDown={onKeyDown}>
      <div data-list-row>
        <button data-list-item>one</button>
        <button>action one</button>
      </div>
      <div data-list-row>
        <button data-list-item>two</button>
        <button>action two</button>
      </div>
      <div data-list-row>
        <button data-list-item>three</button>
      </div>
    </div>
  );
}

describe('useListKeys', () => {
  it('moves Down and Up between items and clamps at the ends (no wrap)', async () => {
    render(<List />);
    screen.getByText('one').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByText('two')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByText('three')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByText('two')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByText('one')).toHaveFocus();
  });

  it('goes to the first and last item with Home and End', async () => {
    render(<List />);
    screen.getByText('two').focus();
    await userEvent.keyboard('{End}');
    expect(screen.getByText('three')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByText('one')).toHaveFocus();
  });

  it('starts from the row of an action button', async () => {
    render(<List />);
    screen.getByText('action one').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByText('two')).toHaveFocus();
  });

  it('has no type-ahead: a letter does not move focus', async () => {
    render(<List />);
    screen.getByText('one').focus();
    await userEvent.keyboard('t');
    expect(screen.getByText('one')).toHaveFocus();
  });
});
