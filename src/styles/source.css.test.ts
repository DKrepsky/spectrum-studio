import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * jsdom cannot lay anything out, so this guards the fixed widths that keep the name column of
 * every source row constant (design 2.1). Real pixels are checked by the e2e visual guard.
 */
const css = readFileSync(resolve(__dirname, 'source.css'), 'utf8');

/** Declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1]!.replace(/\s+/g, ' ');
}

describe('source.css contract', () => {
  it('lays a row out as 18px | flexible name | 64px with a fixed row height', () => {
    const item = rule('.source-item');
    expect(item).toContain('display: grid');
    expect(item).toContain('grid-template-columns: 18px minmax(0, 1fr) 64px');
    expect(item).toContain('min-height: 44px');
    expect(item).toContain('padding: 5px 8px');
    expect(item).toContain('column-gap: 8px');
  });

  it('gives the badge the whole 64px column whatever its text', () => {
    const badge = rule('.src-badge');
    expect(badge).toContain('width: 64px');
    expect(badge).toContain('white-space: nowrap');
    expect(badge).toContain('text-align: center');
  });

  it('keeps line 2 always present and shrinks only the detail', () => {
    expect(rule('.row-sub')).toContain('min-height: 17px');
    expect(rule('.row-sub .st')).toContain('flex: none');
    expect(rule('.row-sub .detail')).toContain('text-overflow: ellipsis');
  });

  it('bounds the source button and the popover', () => {
    const button = rule('.source-button');
    expect(button).toContain('min-width: 150px');
    expect(button).toContain('max-width: 280px');
    const control = rule('.source-control');
    expect(control).toContain('flex: 0 1 auto');
    const popover = rule('.source-popover');
    expect(popover).toContain('width: 360px');
    expect(popover).toContain('min-width: 280px');
    expect(popover).toContain('max-width: calc(100vw - 16px)');
    expect(popover).toContain('max-height: 70vh');
  });

  it('truncates names with an ellipsis instead of wrapping', () => {
    const name = rule('.src-name');
    expect(name).toContain('text-overflow: ellipsis');
    expect(name).toContain('white-space: nowrap');
    expect(name).toContain('min-width: 0');
  });

  it('hides the actions without removing them, so showing them moves nothing', () => {
    const actions = rule('.source-actions');
    expect(actions).toContain('position: absolute');
    expect(actions).toContain('width: 64px');
    expect(actions).toContain('opacity: 0');
    expect(actions).toContain('pointer-events: none');
    expect(actions).not.toContain('display: none');
  });

  it('keeps hidden actions focusable: no visibility:hidden anywhere in the actions rules', () => {
    // visibility:hidden removes an element from the focus order, so ArrowRight from a row
    // could never reach Edit/Forget while the pointer was away (QA 002, BUG-1).
    expect(rule('.source-actions')).not.toContain('visibility');
    expect(rule('.source-row:hover .source-actions,\n.source-actions:focus-within')).not.toContain(
      'visibility',
    );
    expect(css).not.toMatch(/^\s*visibility\s*:/m);
  });

  it('reveals the actions on hover and on focus inside them, and only then makes them clickable', () => {
    const reveal = rule('.source-row:hover .source-actions,\n.source-actions:focus-within');
    expect(reveal).toContain('opacity: 1');
    expect(reveal).toContain('transform: none');
    expect(reveal).toContain('pointer-events: auto');
    expect(rule('.source-actions')).toContain('pointer-events: none');
  });

  it('fades the badge out while an action button has focus', () => {
    expect(css).toContain('.source-row:has(.source-actions:focus-within) .src-badge');
  });

  it('centres the badge across both lines of a row', () => {
    const badge = rule('.src-badge');
    expect(badge).toContain('grid-row: 1 / span 2');
    expect(badge).toContain('align-self: center');
  });

  it('does not reveal the actions for a focused main item', () => {
    expect(css).not.toContain('.source-row:focus-within');
  });

  it('turns the pulse and the highlight fade off for reduced motion', () => {
    const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
      .map((m) => m[1])
      .join('\n');
    expect(reduced).toMatch(/data-status='connecting'\]::before[\s\S]*animation: none/);
    expect(reduced).toMatch(/data-highlight\][\s\S]*animation: none/);
    expect(reduced).toMatch(/\.spinner::before[\s\S]*animation: none/);
  });

  it('draws every status with a data-status selector, no text glyph for circles', () => {
    for (const state of [
      'connected',
      'acquiring',
      'absent',
      'connecting',
      'disconnecting',
      'failed',
    ]) {
      expect(css).toContain(`.src-dot[data-status='${state}']`);
    }
  });
});
