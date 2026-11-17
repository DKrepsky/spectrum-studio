import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { cssRules, rule } from '../../test/css';
import { ListRow } from './ListRow';

const css = readFileSync(resolve(__dirname, 'Popover.css'), 'utf8');

describe('ListRow', () => {
  it('is a select button named by its label, with the actions beside it, not inside it', async () => {
    const onSelect = vi.fn();
    render(
      <ListRow
        label="Bench, Connected"
        onSelect={onSelect}
        actions={<button type="button">Edit Bench</button>}
      >
        Bench
      </ListRow>,
    );
    const select = screen.getByRole('button', { name: 'Bench, Connected' });
    expect(select).toHaveAttribute('data-list-item');
    expect(select).not.toContainElement(screen.getByRole('button', { name: 'Edit Bench' }));
    await userEvent.click(select);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks the current row with aria-current and no radio or menu state', () => {
    render(
      <ListRow label="A" current onSelect={() => undefined}>
        A
      </ListRow>,
    );
    const select = screen.getByRole('button', { name: 'A' });
    expect(select).toHaveAttribute('aria-current', 'true');
    expect(select).not.toHaveAttribute('role');
    expect(select).not.toHaveAttribute('aria-checked');
  });

  it('uses the two-line height by default and the single-line height for fixed items', () => {
    const { rerender } = render(
      <ListRow label="A" onSelect={() => undefined}>
        A
      </ListRow>,
    );
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('data-size', 'two-line');
    rerender(
      <ListRow label="A" size="single" onSelect={() => undefined}>
        A
      </ListRow>,
    );
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('data-size', 'single');
  });

  it('forwards the test id to the select button', () => {
    render(
      <ListRow label="A" testId="row-a" onSelect={() => undefined}>
        A
      </ListRow>,
    );
    expect(screen.getByTestId('row-a')).toHaveAttribute('data-list-item');
  });

  describe('geometry (Popover.css)', () => {
    it('takes the row height from the token, and the single-line height for single rows', () => {
      expect(rule(css, '.list-row-select')).toContain('height: var(--row-height)');
      expect(rule(css, ".list-row-select[data-size='single']")).toContain(
        'height: var(--row-height-single)',
      );
    });

    it('separates rows by --row-gap, so the pitch is the row height plus the gap', () => {
      expect(rule(css, '.list-row')).toContain('margin-bottom: var(--row-gap)');
      expect(rule(css, '.list-row-select')).toContain('height: var(--row-height)');
    });

    it('centres the actions vertically in the badge column, with the row height unchanged', () => {
      const actions = rule(css, '.list-row-actions');
      expect(actions).toContain('top: calc(50% - var(--target-min) / 2)');
      expect(actions).toContain('bottom: auto');
      expect(actions).toContain('width: var(--badge-column)');
      expect(actions).toContain('height: var(--target-min)');
      expect(actions).toContain('right: calc(1px + var(--space-4))');
      expect(rule(css, '.list-row-select')).toContain('height: var(--row-height)');
    });

    it('draws the keyboard focus ring inside the row box, not outside it (as before 009)', () => {
      const ring = rule(css, '.list-row-select:focus-visible');
      expect(ring).toContain('outline: var(--focus-ring-width) solid var(--color-focus-ring)');
      expect(ring).toContain('outline-offset: calc(-1 * var(--focus-ring-width))');
    });

    it('finds an outside ring (self-check of the inside-ring check)', () => {
      const outside = rule(
        '.list-row-select:focus-visible { outline: 2px solid red; outline-offset: 1px; }',
        '.list-row-select:focus-visible',
      );
      expect(outside).not.toContain('outline-offset: calc(-1 * var(--focus-ring-width))');
    });

    it('keeps the actions focusable when hidden and reveals them on hover or focus within', () => {
      const actions = rule(css, '.list-row-actions');
      expect(actions).toContain('opacity: 0');
      expect(actions).toContain('pointer-events: none');
      expect(actions).not.toContain('visibility');
      // Focus on the select button does not reveal them; focus inside the actions does.
      const reveal = cssRules(css).find((r) =>
        r.selector.includes('.list-row-actions:focus-within'),
      );
      expect(reveal?.selector).not.toContain('.list-row:focus-within');
      expect(reveal?.body).toContain('opacity: 1');
      expect(reveal?.body).toContain('pointer-events: auto');
    });
  });
});
