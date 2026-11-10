import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * jsdom cannot lay anything out, so this guards the fixed geometry that keeps the toolbar still when
 * the mode or the state changes (design.md 3.1). Real pixels are checked by the visual QA.
 */
const css = readFileSync(resolve(__dirname, 'capture.css'), 'utf8');
const app = readFileSync(resolve(__dirname, 'app.css'), 'utf8');

/** Declarations of the first rule whose selector list (whitespace-normalised) is `selector`. */
function rule(source: string, selector: string): string {
  const wanted = selector.replace(/\s+/g, ' ').trim();
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of code.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (match[1]!.replace(/\s+/g, ' ').trim() === wanted) return match[2]!.replace(/\s+/g, ' ');
  }
  throw new Error(`no rule for ${selector}`);
}

describe('capture.css contract', () => {
  it('fixes the main segment at 128px and the chevron at 26px', () => {
    expect(rule(css, '.capture-main')).toContain('width: 128px');
    expect(rule(css, '.capture-chevron')).toContain('width: 26px');
    expect(rule(css, '.capture-chevron')).toContain(
      'border-radius: 0 var(--radius) var(--radius) 0',
    );
  });

  it('gives the control the toolbar height', () => {
    expect(rule(css, '.capture')).toContain('height: var(--control-height)');
  });

  it('draws one focus ring around the whole control, not per segment', () => {
    expect(
      rule(
        css,
        '.capture .capture-main:focus-visible, .capture .capture-chevron:focus-visible, .capture .mode-item:focus-visible',
      ),
    ).toContain('outline: none');
    expect(
      rule(css, '.capture:has(.capture-main:focus-visible, .capture-chevron:focus-visible)'),
    ).toContain('outline: 2px solid var(--info)');
  });

  it('defines the single-capture tokens and the capturing badge colour in app.css', () => {
    expect(app).toMatch(/--single: #a47cff;/);
    expect(app).toMatch(/--single-ink: #120a24;/);
    expect(rule(app, '.liveness-capturing')).toContain('color: var(--single)');
  });

  it('turns both segments red while acquiring, with the danger token and AA ink', () => {
    expect(app).toMatch(/--danger: #ff6b6b;/);
    expect(app).toMatch(/--danger-strong: #f04848;/);
    expect(app).toMatch(/--danger-ink: #120a24;/);
    expect(
      rule(
        css,
        ".capture[data-state='acquiring'] .capture-main, .capture[data-state='acquiring'] .capture-chevron",
      ),
    ).toContain('background: var(--danger)');
    expect(
      rule(
        css,
        ".capture[data-state='acquiring'] .capture-main, .capture[data-state='acquiring'] .capture-chevron",
      ),
    ).toContain('color: var(--danger-ink)');
    expect(
      rule(
        css,
        ".capture[data-state='acquiring'] .capture-main:hover:not(:disabled):not([aria-disabled='true']), .capture[data-state='acquiring'] .capture-chevron:hover:not(:disabled):not([aria-disabled='true'])",
      ),
    ).toContain('background: var(--danger-strong)');
  });

  it('keeps the same fixed geometry while acquiring (no width or height override)', () => {
    const acquiring = css.match(/\.capture\[data-state='acquiring'\][^{]*\{[^}]*\}/g) ?? [];
    expect(acquiring.length).toBeGreaterThan(0);
    for (const block of acquiring) {
      expect(block).not.toMatch(/\bwidth\s*:/);
      expect(block).not.toMatch(/\bheight\s*:/);
    }
  });

  it('no longer draws the menu footer', () => {
    expect(css).not.toMatch(/mode-foot/);
  });

  it('no longer draws Pause amber or a SIMULATED badge', () => {
    expect(app).not.toMatch(/primary\.stop/);
    expect(app).not.toMatch(/badge\.simulated/);
  });
});
