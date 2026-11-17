import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { rule } from '../../test/css';
import { Section } from './Section';

const css = readFileSync(resolve(__dirname, 'Section.css'), 'utf8');

describe('Section', () => {
  it('is a native details with the title in its summary, closed by default', () => {
    const { container } = render(
      <Section title="Acquisition">
        <p>body</p>
      </Section>,
    );
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(screen.getByText('Acquisition').tagName).toBe('SUMMARY');
    expect(details.querySelector('.ui-section-body')).toHaveTextContent('body');
  });

  it('opens when open is set', () => {
    const { container } = render(<Section title="Display" open />);
    expect(container.querySelector('details')!.open).toBe(true);
  });

  it('toggles when its summary is clicked', async () => {
    const { container } = render(<Section title="Display" />);
    const details = container.querySelector('details')!;
    await userEvent.click(screen.getByText('Display'));
    expect(details.open).toBe(true);
    await userEvent.click(screen.getByText('Display'));
    expect(details.open).toBe(false);
  });

  it('draws a focus ring on the summary', () => {
    expect(rule(css, '.ui-section-summary:focus-visible')).toContain('var(--color-focus-ring)');
  });
});
