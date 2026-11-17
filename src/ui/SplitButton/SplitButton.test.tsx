import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { rule } from '../../test/css';
import { SplitButton } from './SplitButton';

const css = readFileSync(resolve(__dirname, 'SplitButton.css'), 'utf8');

function renderSplit(
  overrides: Partial<Parameters<typeof SplitButton>[0]['main']> = {},
  chevron: Partial<Parameters<typeof SplitButton>[0]['chevron']> = {},
) {
  const onMain = vi.fn();
  const onChevron = vi.fn();
  render(
    <SplitButton
      groupLabel="Capture"
      tone="accent"
      main={{
        label: 'Continuous',
        ariaLabel: 'Start continuous acquisition',
        onPress: onMain,
        testId: 'main',
        ...overrides,
      }}
      chevron={{
        ariaLabel: 'Capture mode: Continuous',
        expanded: false,
        onPress: onChevron,
        testId: 'chevron',
        ...chevron,
      }}
    >
      <span>popup slot</span>
    </SplitButton>,
  );
  return { onMain, onChevron };
}

describe('SplitButton', () => {
  it('is a labelled group with a main action and a chevron that opens a menu', () => {
    renderSplit();
    const group = screen.getByRole('group', { name: 'Capture' });
    expect(group).toHaveAttribute('data-tone', 'accent');
    expect(group).not.toHaveAttribute('data-mode');
    expect(screen.getByRole('button', { name: 'Start continuous acquisition' })).toHaveTextContent(
      'Continuous',
    );
    const chevron = screen.getByRole('button', { name: 'Capture mode: Continuous' });
    expect(chevron).toHaveAttribute('aria-haspopup', 'menu');
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the popup slot inside the group', () => {
    renderSplit();
    expect(screen.getByRole('group', { name: 'Capture' })).toContainElement(
      screen.getByText('popup slot'),
    );
  });

  it('reports expanded and a dialog popup when asked', () => {
    renderSplit({}, { expanded: true, popup: 'dialog' });
    const chevron = screen.getByRole('button', { name: 'Capture mode: Continuous' });
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    expect(chevron).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('marks a busy main action aria-disabled, and keeps it focusable', () => {
    const { onMain } = renderSplit({ busy: true });
    const main = screen.getByRole('button', { name: 'Start continuous acquisition' });
    expect(main).toBeEnabled();
    expect(main).toHaveAttribute('aria-disabled', 'true');
    main.focus();
    expect(main).toHaveFocus();
    expect(onMain).not.toHaveBeenCalled();
  });

  it('marks a locked chevron aria-disabled with its reason as the title, and natively disables a missing source', () => {
    renderSplit({}, { locked: true, title: 'Pause or cancel acquisition to change the mode' });
    const chevron = screen.getByRole('button', { name: 'Capture mode: Continuous' });
    expect(chevron).toHaveAttribute('aria-disabled', 'true');
    expect(chevron).toHaveAttribute('title', 'Pause or cancel acquisition to change the mode');
  });

  it('describes each segment by the element that says why it is unavailable', () => {
    render(
      <>
        <span id="why-main">Connect a source first</span>
        <span id="why-chevron">Pause or cancel acquisition to change the mode</span>
        <SplitButton
          groupLabel="Capture"
          tone="accent"
          main={{ label: 'Continuous', onPress: vi.fn(), describedBy: 'why-main' }}
          chevron={{
            ariaLabel: 'Capture mode: Continuous',
            expanded: false,
            locked: true,
            onPress: vi.fn(),
            describedBy: 'why-chevron',
          }}
        />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Continuous' })).toHaveAccessibleDescription(
      'Connect a source first',
    );
    expect(
      screen.getByRole('button', { name: 'Capture mode: Continuous' }),
    ).toHaveAccessibleDescription('Pause or cancel acquisition to change the mode');
  });

  it('forwards the main segment data attributes the feature reads', () => {
    renderSplit({ dataMode: 'single', dataState: 'acquiring' });
    expect(screen.getByTestId('main')).toHaveAttribute('data-mode', 'single');
    expect(screen.getByTestId('main')).toHaveAttribute('data-state', 'acquiring');
  });

  it('natively disables both segments when there is no source', () => {
    renderSplit({ disabled: true }, { disabled: true });
    expect(screen.getByRole('button', { name: 'Start continuous acquisition' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Capture mode: Continuous' })).toBeDisabled();
  });

  it('calls the press handlers of both segments', async () => {
    const { onMain, onChevron } = renderSplit();
    await userEvent.click(screen.getByRole('button', { name: 'Start continuous acquisition' }));
    await userEvent.click(screen.getByRole('button', { name: 'Capture mode: Continuous' }));
    expect(onMain).toHaveBeenCalledTimes(1);
    expect(onChevron).toHaveBeenCalledTimes(1);
  });

  it('draws one focus ring around the whole group, not one per segment', () => {
    // jsdom has no layout or :focus-visible, so the contract is read from the stylesheet.
    expect(
      rule(
        css,
        '.split-button .split-main:focus-visible, .split-button .split-chevron:focus-visible',
      ),
    ).toContain('outline: none');
    expect(
      rule(css, '.split-button:has(.split-main:focus-visible, .split-chevron:focus-visible)'),
    ).toContain('outline: var(--focus-ring-width) solid var(--color-focus-ring)');
    expect(rule(css, '.split-main, .split-chevron')).not.toMatch(/outline:\s*(?!none)/);
  });

  it('fixes the segment widths through tokens, so no state moves the toolbar', () => {
    expect(rule(css, '.split-main')).toContain('width: var(--capture-main-width)');
    expect(rule(css, '.split-chevron')).toContain('width: var(--capture-chevron-width)');
    expect(rule(css, '.split-button')).toContain('height: var(--control-height)');
  });
});
