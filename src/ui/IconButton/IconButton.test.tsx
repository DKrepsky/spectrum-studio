import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { rule } from '../../test/css';
import { IconButton } from './IconButton';

const css = readFileSync(resolve(__dirname, 'IconButton.css'), 'utf8');

describe('IconButton', () => {
  it('names the button with the required label and shows the glyph', () => {
    render(<IconButton label="Edit Bench SA430">✎</IconButton>);
    const button = screen.getByRole('button', { name: 'Edit Bench SA430' });
    expect(button).toHaveTextContent('✎');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('forwards title and data-testid', () => {
    render(
      <IconButton label="Dismiss" title="Dismiss (Escape)" data-testid="dismiss">
        ×
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button).toHaveAttribute('title', 'Dismiss (Escape)');
    expect(screen.getByTestId('dismiss')).toBe(button);
  });

  it('calls onClick on click, Enter and Space', async () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Remove marker M1" onClick={onClick}>
        ×
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Remove marker M1' });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter} ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('applies the ghost and filled variants', () => {
    const { rerender } = render(<IconButton label="Edit">✎</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('ui-icon-button--ghost');
    rerender(
      <IconButton label="Edit" variant="filled">
        ✎
      </IconButton>,
    );
    expect(screen.getByRole('button')).toHaveClass('ui-icon-button--filled');
  });

  it('keeps the 24 by 24 minimum target', () => {
    expect(rule(css, '.ui-icon-button')).toContain('min-width: var(--target-min)');
    expect(rule(css, '.ui-icon-button')).toContain('min-height: var(--target-min)');
  });

  it('is unavailable with aria-disabled, ignores the click and keeps focus', async () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Forget" unavailable onClick={onClick}>
        ⌫
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Forget' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });
});
