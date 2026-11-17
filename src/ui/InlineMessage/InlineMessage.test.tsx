import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';

import { rule } from '../../test/css';
import { InlineMessage } from './InlineMessage';

const css = readFileSync(resolve(__dirname, 'InlineMessage.css'), 'utf8');

describe('InlineMessage', () => {
  it('defaults to the hint variant', () => {
    render(<InlineMessage>Leave empty to keep the name</InlineMessage>);
    expect(screen.getByText('Leave empty to keep the name')).toHaveClass(
      'ui-inline-message',
      'ui-inline-message--hint',
    );
  });

  it.each(['hint', 'note', 'info', 'warn', 'error'] as const)(
    'applies the %s variant',
    (variant) => {
      render(<InlineMessage variant={variant}>Text</InlineMessage>);
      expect(screen.getByText('Text')).toHaveClass(`ui-inline-message--${variant}`);
    },
  );

  it('forwards id and data-testid so a field can describe itself with it', () => {
    render(
      <InlineMessage variant="error" id="name-error" data-testid="err">
        Connection failed: timeout
      </InlineMessage>,
    );
    const message = screen.getByTestId('err');
    expect(message).toHaveAttribute('id', 'name-error');
    expect(message).toHaveTextContent('Connection failed: timeout');
  });

  it('marks the warning glyph as decorative', () => {
    const { container } = render(<InlineMessage variant="warn">Stale data</InlineMessage>);
    const glyph = container.querySelector('.ui-inline-message__glyph');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Stale data')).toBeInTheDocument();
  });

  it('uses one 12px size for every variant (F8)', () => {
    expect(rule(css, '.ui-inline-message')).toContain('font-size: var(--font-size-sm)');
    expect(css.match(/font-size:[^;]+;/g)).toEqual(['font-size: var(--font-size-sm);']);
  });
});
