import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { rule } from '../../test/css';
import { parseTokens, resolveToken } from '../../test/tokens';

/**
 * jsdom cannot lay anything out, so this guards the fixed geometry of SplitButton, the capture
 * control, which keeps the toolbar still when the mode or the state changes (DESIGN.md 4.3, 3.3).
 * The geometry is named by tokens, so the numbers live once, in tokens.css. Real pixels are checked
 * by the visual QA.
 */
const split = readFileSync(resolve(__dirname, 'SplitButton.css'), 'utf8');
const tokens = parseTokens(readFileSync(resolve(__dirname, '../../styles/tokens.css'), 'utf8'));

describe('SplitButton geometry contract', () => {
  it('defines the segment widths and the control height as tokens', () => {
    expect(resolveToken('--capture-main-width', tokens)).toBe('128px');
    expect(resolveToken('--capture-chevron-width', tokens)).toBe('26px');
    expect(resolveToken('--control-height', tokens)).toBe('30px');
  });

  it('fixes the main segment and the chevron through those tokens', () => {
    expect(rule(split, '.split-main')).toContain('width: var(--capture-main-width)');
    expect(rule(split, '.split-chevron')).toContain('width: var(--capture-chevron-width)');
    expect(rule(split, '.split-button')).toContain('height: var(--control-height)');
  });

  it('draws one focus ring around the whole control, outside it, not per segment', () => {
    expect(
      rule(
        split,
        '.split-button .split-main:focus-visible, .split-button .split-chevron:focus-visible',
      ),
    ).toContain('outline: none');
    const ring = rule(
      split,
      '.split-button:has(.split-main:focus-visible, .split-chevron:focus-visible)',
    );
    expect(ring).toContain('outline: var(--focus-ring-width) solid var(--color-focus-ring)');
    expect(ring).toContain('outline-offset: var(--focus-ring-offset-group)');
  });

  it('turns both segments red while acquiring, with the danger token and its text colour', () => {
    expect(resolveToken('--color-danger', tokens)).toMatch(/^#[0-9a-f]{6}$/);
    expect(
      rule(
        split,
        ".split-button[data-tone='danger'] .split-main, .split-button[data-tone='danger'] .split-chevron",
      ),
    ).toContain('background: var(--color-danger)');
    expect(
      rule(
        split,
        ".split-button[data-tone='danger'] .split-main, .split-button[data-tone='danger'] .split-chevron",
      ),
    ).toContain('color: var(--color-text-on-danger)');
  });

  it('keeps the same fixed geometry in every tone and state (no width or height override)', () => {
    const blocks = split.match(/\.split-button\[data-[^{]*\{[^}]*\}/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).not.toMatch(/\bwidth\s*:/);
      expect(block).not.toMatch(/\bheight\s*:/);
    }
  });
});
