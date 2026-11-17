import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cssRules } from '../../test/css';
import { Badge } from './Badge';

const css = readFileSync(resolve(__dirname, 'Badge.css'), 'utf8');

describe('Badge', () => {
  it('renders its text as it is, as a span', () => {
    render(<Badge variant="chip">USB</Badge>);
    const badge = screen.getByText('USB');
    expect(badge.tagName).toBe('SPAN');
    expect(badge).toHaveClass('ui-badge');
  });

  it('marks the variant and defaults to the neutral tone', () => {
    render(<Badge variant="tag">LIVE</Badge>);
    const badge = screen.getByText('LIVE');
    expect(badge).toHaveAttribute('data-variant', 'tag');
    expect(badge).toHaveAttribute('data-tone', 'neutral');
  });

  it.each(['neutral', 'live', 'waiting', 'warn', 'capturing'] as const)(
    'carries the %s tone',
    (tone) => {
      render(
        <Badge variant="chip" tone={tone}>
          x
        </Badge>,
      );
      expect(screen.getByText('x')).toHaveAttribute('data-tone', tone);
    },
  );

  it('forwards native attributes and merges className', () => {
    render(
      <Badge variant="chip" className="transport" data-testid="transport" title="Serial port">
        Serial
      </Badge>,
    );
    const badge = screen.getByTestId('transport');
    expect(badge).toHaveClass('ui-badge', 'transport');
    expect(badge).toHaveAttribute('title', 'Serial port');
  });

  it('keeps the case of a tag: the state word is typed as it is shown, the CSS does not uppercase it', () => {
    const tag = cssRules(css).filter((r) => r.selector.includes("data-variant='tag'"));
    expect(tag.length).toBeGreaterThan(0);
    expect(tag.some((r) => /text-transform/.test(r.body))).toBe(false);
  });

  it('finds a text-transform on a tag (self-check of the case guard)', () => {
    const planted = cssRules(".ui-badge[data-variant='tag'] { text-transform: uppercase; }");
    expect(planted.some((r) => /text-transform/.test(r.body))).toBe(true);
  });
});
