import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cssRules, rule } from '../../test/css';

/**
 * jsdom cannot lay anything out, so this guards the widths of the source feature by token name
 * (design 2.1): the name column of every row is the same whatever its badge, status or hover
 * actions. Real pixels are checked by the e2e visual guard. The popover surface, the rows' hover
 * and the actions are `ui/` and tested in `src/ui/Popover`.
 */
const css = readFileSync(resolve(__dirname, 'source.css'), 'utf8');

describe('source.css contract', () => {
  it('lays a row out as glyph | flexible name | fixed badge column, from tokens', () => {
    const row = rule(css, '.source-row');
    expect(row).toContain(
      'grid-template-columns: var(--glyph-cell) minmax(0, 1fr) var(--badge-column)',
    );
    expect(row).toContain('column-gap: var(--space-4)');
  });

  it('puts glyph and name on line 1, the status line in the name column only', () => {
    expect(rule(css, '.source-row-name')).toContain('grid-row: 1');
    expect(rule(css, '.source-row-sub')).toContain('grid-column: 2');
    expect(rule(css, '.source-row-sub')).toContain('grid-row: 2');
  });

  it('centres the badge on the whole row (both lines), as before 009', () => {
    const badge = rule(css, '.source-row-badge');
    expect(badge).toContain('grid-column: 3');
    expect(badge).toContain('grid-row: 1 / span 2');
    expect(badge).toContain('align-self: center');
  });

  it('gives the badge the whole badge column, centred, and never wider', () => {
    const badge = rule(css, '.source-row-badge');
    expect(badge).toContain('width: var(--badge-column)');
    expect(badge).toContain('justify-content: center');
    expect(badge).toContain('overflow: hidden');
  });

  it('keeps line 2 present (min height) and shrinks only the detail', () => {
    expect(rule(css, '.source-row-sub')).toContain('min-height: var(--source-row-sub-min-height)');
    expect(rule(css, '.source-row-status')).toContain('flex: none');
    expect(rule(css, '.source-row-detail')).toContain('text-overflow: ellipsis');
  });

  it('sizes the Undo toast as a two-line row, as before 009', () => {
    expect(rule(css, '.source-toast')).toContain('min-height: var(--row-height)');
  });

  it('fills the side panel column: no width cap, and a popover as wide as the control', () => {
    expect(rule(css, '.source-control')).toContain('width: 100%');
    expect(rule(css, '.source-button')).not.toMatch(/max-width|min-width: var\(--source-name/);
    expect(rule(css, '.source-control > .popover-source')).toContain('width: 100%');
  });

  it('truncates every name with an ellipsis instead of wrapping', () => {
    // The names share one rule (a selector list): find the rule that names each one.
    for (const selector of ['.source-button-name', '.source-row-name', '.source-toast-text']) {
      const body = cssRules(css)
        .filter((r) =>
          r.selector
            .split(',')
            .map((x) => x.trim())
            .includes(selector),
        )
        .map((r) => r.body)
        .join(' ');
      expect(body, selector).toContain('text-overflow: ellipsis');
      expect(body, selector).toContain('white-space: nowrap');
      expect(body, selector).toContain('min-width: 0');
    }
  });

  it('fades the badge while the row is hovered or one of its actions has focus', () => {
    expect(css).toContain('.list-row:hover .source-row-badge');
    expect(css).toContain('.list-row:has(.list-row-actions:focus-within) .source-row-badge');
    expect(css).not.toContain('.source-row:focus-within');
  });

  it('turns the badge fade off for reduced motion', () => {
    const reduced = cssRules(css).filter((r) => r.within.some((w) => w.includes('reduced-motion')));
    expect(reduced.some((r) => r.selector.includes('.source-row-badge'))).toBe(true);
  });

  it('has no legacy spinner: the dialog uses ui Spinner', () => {
    expect(css).not.toMatch(/\.spinner\b/);
  });

  it('draws no status glyph and no popover surface: those are ui now', () => {
    expect(css).not.toMatch(
      /\.src-dot|\.source-popover|\.source-item|\.source-actions|\.src-badge/,
    );
    expect(css).not.toMatch(/box-shadow\s*:/);
    expect(css).not.toMatch(/^\s*visibility\s*:/m);
  });
});
