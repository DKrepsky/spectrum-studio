import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { rule } from '../../test/css';
import { Button } from './Button';

const css = readFileSync(resolve(__dirname, 'Button.css'), 'utf8');

describe('Button', () => {
  it('renders a native button of type button by default and forwards native attributes', () => {
    render(
      <Button data-testid="go" title="Go now" name="go">
        Go
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toBe(screen.getByTestId('go'));
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('title', 'Go now');
    expect(button).toHaveAttribute('name', 'go');
  });

  it('forwards a ref to the element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Save' }));
  });

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the variant and size classes', () => {
    const { rerender } = render(<Button>Plain</Button>);
    expect(screen.getByRole('button')).toHaveClass('ui-button', 'ui-button--default');
    expect(screen.getByRole('button')).not.toHaveClass('ui-button--small');
    rerender(
      <Button variant="primary" size="small">
        Primary
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass('ui-button--primary', 'ui-button--small');
    rerender(<Button variant="destructive">Forget</Button>);
    expect(screen.getByRole('button')).toHaveClass('ui-button--destructive');
    expect(screen.getByRole('button')).not.toHaveClass('ui-button--small');
  });

  it('sizes the small variant at the 24px control height', () => {
    expect(rule(css, '.ui-button--small')).toContain('min-height: var(--control-height-small)');
    expect(rule(css, '.ui-button')).toContain('min-height: var(--control-height)');
  });

  it('is unavailable with aria-disabled, ignores the click and keeps focus', async () => {
    const onClick = vi.fn();
    render(
      <Button unavailable onClick={onClick}>
        Connect
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Connect' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('ignores Enter and Space while unavailable', async () => {
    const onClick = vi.fn();
    render(
      <Button unavailable onClick={onClick}>
        Connect
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Connect' });
    button.focus();
    await userEvent.keyboard('{Enter} ');
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('keeps native disabled working', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('dims unavailable buttons with the unavailable opacity token', () => {
    expect(rule(css, '.ui-button--unavailable, .ui-button:disabled')).toContain(
      'opacity: var(--opacity-unavailable)',
    );
  });

  it('shows a spinner while busy, keeps the label, sets aria-busy and ignores the click', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button busy onClick={onClick}>
        Connect
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Connect' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass('ui-button--busy');
    expect(container.querySelector('.ui-spinner')).not.toBeNull();
    expect(button).toHaveTextContent('Connect');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('keeps the same label node and accessible name when busy', () => {
    const { rerender } = render(<Button>Save</Button>);
    const idle = screen.getByRole('button', { name: 'Save' });
    const idleLabel = idle.querySelector('.ui-button__label');
    expect(idleLabel).toHaveTextContent('Save');
    expect(idle.querySelector('.ui-button__overlay')).toBeNull();
    expect(idle.querySelector('.ui-button__lead')).toBeNull();

    rerender(<Button busy>Save</Button>);
    const busy = screen.getByRole('button', { name: 'Save' });
    expect(busy.querySelector('.ui-button__label')).toBe(idleLabel);
    expect(busy.querySelector('.ui-button__label')).toHaveTextContent('Save');
  });

  it('overlays the spinner on the label without an icon, so the label keeps its box', () => {
    render(<Button busy>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    const label = button.querySelector('.ui-button__label');
    const overlay = button.querySelector('.ui-button__overlay');
    expect(label).toHaveClass('ui-button__label--masked');
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay?.querySelector('.ui-spinner')).not.toBeNull();
    expect(button.querySelector('.ui-button__lead')).toBeNull();
  });

  it('puts the spinner in the icon slot when busy with an icon, and keeps the label visible', () => {
    render(
      <Button busy icon={<span data-testid="glyph">+</span>}>
        Add
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Add' });
    const lead = button.querySelector('.ui-button__lead');
    expect(lead?.querySelector('.ui-spinner')).not.toBeNull();
    expect(button.querySelector('.ui-button__overlay')).toBeNull();
    expect(button.querySelector('.ui-button__label')).not.toHaveClass('ui-button__label--masked');
    expect(button.querySelector('.ui-button__label')).toHaveTextContent('Add');
  });

  it('never moves the label when busy: the overlay is absolute and the icon slot has a fixed token width', () => {
    expect(rule(css, '.ui-button')).toContain('position: relative');
    expect(rule(css, '.ui-button__overlay')).toContain('position: absolute');
    expect(rule(css, '.ui-button__overlay')).toContain('inset: 0');
    expect(rule(css, '.ui-button__label--masked')).toContain('color: transparent');
    expect(rule(css, '.ui-button__lead')).toContain('width: var(--button-icon-slot)');
    expect(rule(css, '.ui-button__lead')).toContain('height: var(--button-icon-slot)');
    expect(rule(css, '.ui-button__lead .ui-spinner, .ui-button__overlay .ui-spinner')).toContain(
      'color: inherit',
    );
  });

  it('renders the icon before the label, hidden from assistive technology', () => {
    render(<Button icon={<span data-testid="glyph">+</span>}>Add</Button>);
    const glyph = screen.getByTestId('glyph');
    expect(glyph.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveTextContent('+Add');
  });

  it('replaces the icon with the spinner while busy', () => {
    render(
      <Button busy icon={<span data-testid="glyph">+</span>}>
        Add
      </Button>,
    );
    expect(screen.queryByTestId('glyph')).toBeNull();
    expect(document.querySelector('.ui-spinner')).not.toBeNull();
  });

  it('keeps the primary label accessible name from its text only', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
