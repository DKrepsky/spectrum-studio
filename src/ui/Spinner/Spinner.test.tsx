import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';

import { rule } from '../../test/css';
import { Spinner } from './Spinner';

const css = readFileSync(resolve(__dirname, 'Spinner.css'), 'utf8');

describe('Spinner', () => {
  it('is decorative (hidden from assistive technology) without a label', () => {
    const { container } = render(<Spinner />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.ui-spinner__label')).toBeNull();
  });

  it('shows the label as text and is not hidden when it names the work', () => {
    render(<Spinner label="Connecting…" data-testid="spin" />);
    expect(screen.getByText('Connecting…')).toBeVisible();
    expect(screen.getByTestId('spin')).not.toHaveAttribute('aria-hidden');
  });

  it('turns into a static ellipsis under reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain("content: '\\2026'");
    expect(rule(css, '.ui-spinner__glyph::before')).toContain('var(--motion-duration-spin)');
  });
});
