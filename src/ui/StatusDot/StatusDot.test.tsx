import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render } from '@testing-library/react';

import { cssRules, rule } from '../../test/css';
import { StatusDot, type StatusDotStatus } from './StatusDot';

const STATUSES: StatusDotStatus[] = [
  'connected',
  'acquiring',
  'connecting',
  'disconnecting',
  'failed',
  'absent',
  'idle',
];
const css = readFileSync(resolve(__dirname, 'StatusDot.css'), 'utf8');

/** The body of every rule whose selector list names `status` (shared rules name several). */
function bodiesFor(status: string): string {
  return cssRules(css)
    .filter((r) => r.selector.includes(`[data-status='${status}']`))
    .map((r) => `${r.selector} { ${r.body} }`)
    .join('\n');
}

describe('StatusDot', () => {
  it.each(STATUSES)('renders %s as a decorative, hidden element', (status) => {
    const { container } = render(<StatusDot status={status} />);
    const dot = container.firstElementChild!;
    expect(dot).toHaveAttribute('data-status', status);
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toBeEmptyDOMElement();
  });

  it('keeps aria-hidden even when a caller passes other attributes', () => {
    const { container } = render(<StatusDot status="idle" className="x" aria-hidden="false" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveClass('ui-status-dot', 'x');
  });

  it('has a shape rule for every status, and the failed status is a cross, not a dot', () => {
    // `idle` has no rule of its own: it is the base dot.
    expect(css).toContain('.ui-status-dot::before {');
    for (const status of STATUSES.filter((s) => s !== 'idle')) {
      expect(bodiesFor(status)).toContain('::before');
    }
    expect(rule(css, ".ui-status-dot[data-status='failed']::before")).toContain("content: '✕'");
  });

  it('pulses connecting and disconnecting, and stops the pulse under reduced motion', () => {
    expect(bodiesFor('connecting')).toContain('animation: ui-status-pulse');
    expect(bodiesFor('disconnecting')).toContain('animation: ui-status-pulse');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/data-status='connecting'\]::before[\s\S]*animation: none/);
    expect(reduced).toMatch(/data-status='disconnecting'\]::before[\s\S]*animation: none/);
    expect(reduced).toContain('box-shadow: var(--halo-info)');
  });
});
