import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { cssRules } from '../test/css';
import {
  contrastRatio,
  over,
  parseTokens,
  resolveToken,
  toRgba,
  type Rgba,
  type Tokens,
} from '../test/tokens';

/**
 * Token contract (DESIGN.md 2.18): one token file, every reference defined, no literal colour,
 * radius, shadow or z-index in CSS outside the token file, the 9.3/9.4 contrast pairs met, and the
 * token file equal to Appendix A, and no pixel literal in a spacing or size property outside the
 * token file (DESIGN.md 2.9, 2.17). jsdom cannot lay out or resolve `var()`, so this reads the files.
 */

const SRC = resolve(__dirname, '..');
const REPO = resolve(__dirname, '../..');
const tokensCss = readFileSync(join(__dirname, 'tokens.css'), 'utf8');
const tokens: Tokens = parseTokens(tokensCss);

/** The migration aliases: the names declared in the token file's migration-only `:root` block. */
const ALIASES = (() => {
  const block = /\/\* alias: migration only \*\/[\s\S]*?:root \{([\s\S]*?)\n\}/.exec(tokensCss);
  if (!block) throw new Error('the token file has no migration alias block');
  return [...block[1]!.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!);
})();

/** Every file under `dir` whose name matches `pattern`, as absolute paths. */
function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path, pattern);
    return pattern.test(name) ? [path] : [];
  });
}

/** Token names used through `var(...)` in `text` that have no definition in `tokens.css`. */
function undefinedTokens(text: string, defined: Tokens): string[] {
  return [...text.matchAll(/var\(\s*(--[\w-]+)/g)]
    .map((m) => m[1]!)
    .filter((name) => !defined.has(name));
}

/** Literal colour, shadow, radius and z-index values in the declarations of a stylesheet. */
function literalViolations(css: string): string[] {
  const found: string[] = [];
  for (const r of cssRules(css)) {
    for (const declaration of r.body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const prop = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      const where = `${r.selector} { ${prop}: ${value} }`;
      const withoutTokens = value.replace(/var\([^)]*\)/g, '');
      if (/#[0-9a-f]{3,8}\b/i.test(value)) found.push(`${where}: hex colour`);
      if (/\b(?:rgb|rgba|hsl|hsla)\(/i.test(value)) found.push(`${where}: colour function`);
      if (prop === 'box-shadow' && value !== 'none' && !/^var\([^()]*\)$/.test(value)) {
        found.push(`${where}: shadow literal`);
      }
      if (prop.endsWith('border-radius')) {
        for (const size of withoutTokens.match(/[\d.]+(?:px|em|rem|%)?/g) ?? []) {
          if (!['0', '0px', '50%'].includes(size)) found.push(`${where}: radius literal ${size}`);
        }
      }
      if (prop === 'z-index' && value !== '0' && !/^var\([^()]*\)$/.test(value)) {
        found.push(`${where}: z-index literal`);
      }
    }
  }
  return found;
}

/**
 * Properties whose pixel values are spacing or size (DESIGN.md 2.17). A pixel literal in one of them
 * must be a token, or a `calc()` of tokens. The check is by name, so a new spacing property needs
 * a name here.
 */
const SIZE_PROPERTY =
  /^(?:padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|grid-template-columns|grid-template-rows|flex|flex-basis|font-size|outline|outline-offset|outline-width|border|border-width|border-(?:top|right|bottom|left)(?:-width)?)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/;

/**
 * The hairline values that stay literal (DESIGN.md 2.17): no border, divider or offset is a
 * token. `0` needs no unit. `-1px` is a hairline pulled over an edge (the visually hidden box).
 */
const HAIRLINE = ['0', '0px', '1px', '-1px'];

/** Pixel literals in spacing and size declarations of a stylesheet, outside the allowed hairlines. */
function sizeViolations(css: string): string[] {
  const found: string[] = [];
  for (const r of cssRules(css)) {
    for (const declaration of r.body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const prop = declaration.slice(0, colon).trim().toLowerCase();
      if (!SIZE_PROPERTY.test(prop)) continue;
      const value = declaration.slice(colon + 1).trim();
      const withoutTokens = value.replace(/var\([^)]*\)/g, '');
      for (const px of withoutTokens.match(/-?\d*\.?\d+px/g) ?? []) {
        if (!HAIRLINE.includes(px)) found.push(`${r.selector} { ${prop}: ${value} }: ${px}`);
      }
    }
  }
  return found;
}

/** A colour token as a colour; a translucent one is composited over the `under` colour. */
type Paint = string | [layer: string, under: Paint];

function paint(p: Paint): Rgba {
  if (typeof p === 'string') return toRgba(resolveToken(p, tokens));
  return over(toRgba(resolveToken(p[0], tokens)), paint(p[1]));
}

interface Pair {
  text: Paint;
  on: Paint;
  /** The ratio printed in DESIGN.md (two decimals). */
  table: number;
  need: number;
  why: string;
}

// DESIGN.md 9.3: text contrast. Ratios transcribed from the table, need 4.5:1 unless noted.
const TEXT: Pair[] = [
  {
    text: '--color-text-primary',
    on: '--color-surface-panel',
    table: 13.62,
    need: 4.5,
    why: 'primary on panel',
  },
  {
    text: '--color-text-primary',
    on: '--color-surface-raised',
    table: 12.44,
    need: 4.5,
    why: 'primary on raised',
  },
  {
    text: '--color-text-primary',
    on: '--color-surface-control',
    table: 11.09,
    need: 4.5,
    why: 'button label',
  },
  {
    text: '--color-text-primary',
    on: '--color-surface-control-hover',
    table: 9.78,
    need: 4.5,
    why: 'hovered button label',
  },
  {
    text: '--color-text-secondary',
    on: '--color-surface-app',
    table: 6.66,
    need: 4.5,
    why: 'secondary on app',
  },
  {
    text: '--color-text-secondary',
    on: '--color-surface-panel',
    table: 6.11,
    need: 4.5,
    why: 'secondary on panel',
  },
  {
    text: '--color-text-secondary',
    on: '--color-surface-raised',
    table: 5.58,
    need: 4.5,
    why: 'secondary on raised',
  },
  {
    text: '--color-text-secondary',
    on: '--color-surface-control',
    table: 4.97,
    need: 4.5,
    why: 'badge, row sub-line',
  },
  { text: '--color-accent', on: '--color-surface-panel', table: 10.43, need: 4.5, why: 'accent' },
  { text: '--color-warn', on: '--color-surface-panel', table: 9.95, need: 4.5, why: 'warning' },
  { text: '--color-danger', on: '--color-surface-raised', table: 5.75, need: 4.5, why: 'danger' },
  { text: '--color-info', on: '--color-surface-panel', table: 7.12, need: 4.5, why: 'info' },
  {
    text: '--color-text-on-accent',
    on: '--color-accent',
    table: 10.21,
    need: 4.5,
    why: 'ink on teal',
  },
  {
    text: '--color-text-on-accent',
    on: '--color-accent-hover',
    table: 7.96,
    need: 4.5,
    why: 'ink on teal hover',
  },
  {
    text: '--color-text-on-violet',
    on: '--color-capture-single',
    table: 6.31,
    need: 4.5,
    why: 'ink on violet',
  },
  {
    text: '--color-text-on-violet',
    on: '--color-capture-single-hover',
    table: 4.95,
    need: 4.5,
    why: 'ink on violet hover',
  },
  {
    text: '--color-text-on-danger',
    on: '--color-capture-stop',
    table: 6.91,
    need: 4.5,
    why: 'ink on stop',
  },
  {
    text: '--color-text-on-danger',
    on: '--color-capture-stop-hover',
    table: 5.23,
    need: 4.5,
    why: 'ink on stop hover',
  },
  {
    text: '--color-accent',
    on: ['--color-tint-ok', '--color-surface-raised'],
    table: 8.05,
    need: 4.5,
    why: 'success text on tint',
  },
  {
    text: '--color-danger',
    on: ['--color-tint-error-subtle', '--color-surface-raised'],
    table: 5.19,
    need: 4.5,
    why: 'failed text on tint',
  },
  {
    text: '--color-warn',
    on: ['--color-tint-warn', '--color-surface-panel'],
    table: 7.86,
    need: 4.5,
    why: 'warning text on tint',
  },
  {
    text: '--color-danger',
    on: ['--color-tint-error', '--color-surface-panel'],
    table: 5.38,
    need: 4.5,
    why: 'error text on tint',
  },
  {
    text: '--color-text-primary',
    on: ['--color-tint-warn', '--color-surface-panel'],
    table: 10.76,
    need: 4.5,
    why: 'primary on warning tint',
  },
  {
    text: '--color-text-axis',
    on: '--color-surface-plot',
    table: 6.86,
    need: 4.5,
    why: 'canvas tick text',
  },
  {
    text: '--color-text-secondary',
    on: '--color-surface-plot',
    table: 6.4,
    need: 4.5,
    why: 'canvas hint',
  },
  {
    text: '--color-accent',
    on: ['--color-scrim-chip', '--color-surface-plot'],
    table: 11.56,
    need: 4.5,
    why: 'LIVE tag',
  },
  {
    text: '--color-warn',
    on: ['--color-scrim-chip', '--color-surface-plot'],
    table: 11.02,
    need: 4.5,
    why: 'waiting and stale tag',
  },
  {
    text: '--color-capture-single',
    on: ['--color-scrim-chip', '--color-surface-plot'],
    table: 6.37,
    need: 4.5,
    why: 'CAPTURING tag',
  },
  {
    text: '--color-text-secondary',
    on: ['--color-scrim-chip', '--color-surface-plot'],
    table: 6.77,
    need: 4.5,
    why: 'HOLD tag',
  },
  {
    text: '--color-text-readout',
    on: ['--color-scrim-readout', '--color-surface-plot'],
    table: 16.5,
    need: 4.5,
    why: 'crosshair readout',
  },
  {
    text: '--color-text-primary',
    on: ['--color-scrim-chip', '--color-surface-plot'],
    table: 15.1,
    need: 4.5,
    why: 'zoom reset label',
  },
];

// DESIGN.md 9.4: non-text contrast, canvas included. Need 3:1 unless the row says otherwise.
const NON_TEXT: Pair[] = [
  {
    text: '--color-trace-live',
    on: '--color-surface-plot',
    table: 10.93,
    need: 3,
    why: 'live trace',
  },
  {
    text: '--color-trace-max-hold',
    on: '--color-surface-plot',
    table: 8.97,
    need: 3,
    why: 'max hold',
  },
  {
    text: '--color-trace-min-hold',
    on: '--color-surface-plot',
    table: 7.46,
    need: 3,
    why: 'min hold',
  },
  {
    text: '--color-trace-stale',
    on: '--color-surface-plot',
    table: 5.02,
    need: 3,
    why: 'held or stale trace',
  },
  { text: '--color-marker', on: '--color-surface-plot', table: 7.17, need: 3, why: 'marker' },
  { text: '--color-peak', on: '--color-surface-plot', table: 12.7, need: 3, why: 'peak' },
  {
    text: '--color-marker-active',
    on: '--color-surface-plot',
    table: 18.31,
    need: 3,
    why: 'active marker',
  },
  {
    text: ['--color-crosshair', '--color-surface-plot'],
    on: '--color-surface-plot',
    table: 3.83,
    need: 3,
    why: 'crosshair',
  },
  {
    text: '--color-focus-ring',
    on: '--color-surface-app',
    table: 7.77,
    need: 3,
    why: 'focus ring on app',
  },
  {
    text: '--color-focus-ring',
    on: '--color-surface-panel',
    table: 7.12,
    need: 3,
    why: 'focus ring on panel',
  },
  {
    text: '--color-focus-ring',
    on: '--color-surface-raised',
    table: 6.5,
    need: 3,
    why: 'focus ring on raised',
  },
  {
    text: '--color-focus-ring',
    on: '--color-surface-plot',
    table: 7.46,
    need: 3,
    why: 'focus ring on plot',
  },
  { text: '--color-accent', on: '--color-surface-panel', table: 10.43, need: 3, why: 'status dot' },
  {
    text: '--color-text-secondary',
    on: '--color-surface-panel',
    table: 6.11,
    need: 3,
    why: 'status ring (absent)',
  },
  { text: '--color-danger', on: '--color-surface-panel', table: 6.3, need: 3, why: 'status cross' },
  {
    text: '--color-capture-single',
    on: '--color-surface-raised',
    table: 5.25,
    need: 3,
    why: 'violet icon',
  },
  {
    text: '--color-border-input',
    on: '--color-surface-panel',
    table: 3.43,
    need: 3,
    why: 'text field boundary on panel',
  },
  {
    text: '--color-border-input',
    on: '--color-surface-raised',
    table: 3.13,
    need: 3,
    why: 'text field boundary on raised',
  },
  {
    text: '--color-border-input',
    on: '--color-surface-app',
    table: 3.74,
    need: 3,
    why: 'text field boundary on app',
  },
];

describe('design tokens', () => {
  it('defines every token referenced in src/ (CSS, TypeScript and TSX)', () => {
    const missing = filesUnder(SRC, /\.(?:css|tsx?)$/).flatMap((file) =>
      undefinedTokens(readFileSync(file, 'utf8'), tokens).map(
        (name) => `${relative(SRC, file)}: ${name}`,
      ),
    );
    expect(missing).toEqual([]);
  });

  it('finds an undefined token reference (self-check of the scanner)', () => {
    const reference = 'color: ' + 'var(' + '--no-such-token);';
    expect(undefinedTokens(reference, tokens)).toEqual(['--no-such-token']);
    expect(undefinedTokens('color: var(--color-text-primary);', tokens)).toEqual([]);
  });

  it('guards every stylesheet under src/ (no file is exempt from the literal guard)', () => {
    const files = filesUnder(SRC, /\.css$/).map((file) => relative(SRC, file));
    expect(files).toContain('styles/app.css');
    expect(files).toContain('components/source/source.css');
    expect(files.filter((file) => file !== 'styles/tokens.css')).not.toEqual([]);
  });

  it('keeps every migration alias out of CSS: only the token file may name them', () => {
    expect(ALIASES).toContain('--text-muted');
    expect(ALIASES).not.toContain('--motion-duration-pulse');
    expect(ALIASES.length).toBeGreaterThanOrEqual(20);
    const uses = filesUnder(SRC, /\.css$/).flatMap((file) => {
      const css = readFileSync(file, 'utf8');
      return ALIASES.filter((name) => new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(css)).map(
        (name) => `${relative(SRC, file)}: var(${name})`,
      );
    });
    expect(uses.filter((use) => !use.startsWith('styles/tokens.css'))).toEqual([]);
  });

  it('finds an alias use (self-check of the alias guard)', () => {
    const css = 'color: ' + 'var(' + '--text-muted);\ncolor: ' + 'var(' + '--text-muted-x);';
    const hits = ALIASES.filter((name) => new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(css));
    expect(hits).toEqual(['--text-muted']);
  });

  it('keeps literal colours, shadows, radii and z-indexes out of CSS outside the token file', () => {
    const offenders = filesUnder(SRC, /\.css$/)
      .map((file) => relative(SRC, file))
      .filter((file) => file !== 'styles/tokens.css')
      .flatMap((file) =>
        literalViolations(readFileSync(join(SRC, file), 'utf8')).map((v) => `${file}: ${v}`),
      );
    expect(offenders).toEqual([]);
  });

  it('keeps pixel sizes and spacing out of CSS outside the token file, except the hairlines', () => {
    const offenders = filesUnder(SRC, /\.css$/)
      .map((file) => relative(SRC, file))
      .filter((file) => file !== 'styles/tokens.css')
      .flatMap((file) =>
        sizeViolations(readFileSync(join(SRC, file), 'utf8')).map((v) => `${file}: ${v}`),
      );
    expect(offenders).toEqual([]);
  });

  it('flags a pixel size or spacing literal and allows the hairlines (self-check of the size guard)', () => {
    const literal = [
      '.a { padding: 7px var(--space-4); }',
      '.b { gap: 6px; }',
      '.c { top: -2px; }',
      '.d { width: 330px; }',
      '.e { min-height: 17px; }',
      '.f { grid-template-columns: 1fr 330px; }',
      '.g { outline: 2px solid var(--color-focus-ring); }',
      '.h { font-size: 11px; }',
      '.i { padding: calc(1px + 6px); }',
      '.j { border: 2px solid var(--color-border-default); }',
      '.k { padding-inline-start: 9px; }',
    ].join('\n');
    expect(sizeViolations(literal)).toHaveLength(11);
    const clean = [
      '.a { padding: var(--toolbar-padding-y) var(--space-4); gap: var(--space-3); }',
      '.b { margin: 0 -1px 0 1px; width: 100%; height: var(--row-height); }',
      '.c { outline: var(--focus-ring-width) solid var(--color-focus-ring); outline-offset: 1px; }',
      '.d { padding: calc(1px + var(--space-4)); top: calc(50% - var(--target-min) / 2); }',
      '.e { border: 1px solid var(--color-border-default); min-width: 0; font-size: var(--font-size-xs); }',
      '.f { border-radius: 6px; box-shadow: none; line-height: 1.2; letter-spacing: 0.06em; }',
    ].join('\n');
    expect(sizeViolations(clean)).toEqual([]);
  });

  it('flags each kind of literal (self-check of the guard)', () => {
    const literal = [
      '.a { color: #fff; }',
      '.b { background: rgba(0, 0, 0, 0.5); }',
      '.c { box-shadow: 0 1px red; }',
      '.d { border-radius: 6px; }',
      '.e { z-index: 5; }',
    ].join('\n');
    expect(literalViolations(literal)).toHaveLength(5);
    const clean = [
      '.a { color: var(--color-text-primary); box-shadow: none; }',
      '.b { border-radius: 0 var(--radius-md) var(--radius-md) 0; border-radius: 50%; }',
      '.c { z-index: var(--z-popover); outline: 2px solid var(--color-focus-ring); }',
      '.d { border: 1px solid var(--color-border-default); margin: 0; }',
    ].join('\n');
    expect(literalViolations(clean)).toEqual([]);
  });

  it('keeps the geometry the pixel tokens replaced at the value the CSS used before (DESIGN.md 2.9, 2.10)', () => {
    const before: Record<string, string> = {
      '--toolbar-padding-y': '7px',
      '--toolbar-field-gap': '6px',
      '--plot-zoom-reset-inset-left': '76px',
      '--plot-hint-padding-x': '40px',
      '--waterfall-tick-gap': '3px',
      '--legend-swatch-width': '10px',
      '--legend-swatch-height': '3px',
      '--button-icon-slot': '12px',
      '--menu-end-column': '16px',
      '--status-dot-ring-width': '2px',
      '--source-row-sub-min-height': '17px',
      '--panel-width': '330px',
    };
    for (const [name, value] of Object.entries(before)) {
      expect(resolveToken(name, tokens), name).toBe(value);
    }
  });

  it('removes the retired --warn-strong (F12)', () => {
    expect(tokens.has('--warn-strong')).toBe(false);
  });

  it('keeps the migration aliases at the values the CSS used before the token migration', () => {
    const legacy: Record<string, string> = {
      '--bg': '#0b1018',
      '--surface': '#121a26',
      '--surface-2': '#182233',
      '--surface-3': '#1f2b3f',
      '--border': '#26344a',
      '--text': '#dbe4f0',
      '--text-muted': '#8a9ab1',
      '--accent': '#3ee0b5',
      '--accent-strong': '#2bc79e',
      '--warn': '#ffb547',
      '--danger': '#ff6b6b',
      '--danger-strong': '#f04848',
      '--danger-ink': '#120a24',
      '--info': '#5aa9ff',
      '--single': '#a47cff',
      '--single-strong': '#9166f5',
      '--single-ink': '#120a24',
      '--radius': '6px',
      '--font': "'Inter', 'Cantarell', 'Ubuntu', system-ui, sans-serif",
      '--mono': "'JetBrains Mono', 'DejaVu Sans Mono', ui-monospace, monospace",
    };
    for (const [name, value] of Object.entries(legacy)) {
      expect(resolveToken(name, tokens), name).toBe(value);
    }
  });

  it('keeps the contrast of the 9.3 text pairs and the 9.4 non-text pairs', () => {
    const failures: string[] = [];
    for (const pair of [...TEXT, ...NON_TEXT]) {
      const ratio = contrastRatio(paint(pair.text), paint(pair.on));
      const table = Math.round(ratio * 100) / 100;
      if (ratio < pair.need || table !== pair.table) {
        failures.push(`${pair.why}: ${table}:1 (table ${pair.table}, need ${pair.need})`);
      }
    }
    expect(failures).toEqual([]);
    expect(TEXT).toHaveLength(31);
    expect(NON_TEXT).toHaveLength(19);
  });

  it('equals DESIGN.md Appendix A once the migration markers and the layer line are removed', () => {
    const design = readFileSync(join(REPO, 'DESIGN.md'), 'utf8');
    const heading = design.indexOf('## Appendix A.');
    expect(heading).toBeGreaterThan(-1);
    const open = design.indexOf('```css\n', heading);
    const close = design.indexOf('\n```', open + 7);
    const appendix = design.slice(open + 7, close);
    const normalise = (css: string) =>
      css
        .replace(/\/\*\s*alias: migration only\s*\*\//g, '')
        .replace(/@layer [\w-]+;/g, '')
        .replace(/\s+/g, ' ')
        .replace(/ ?([{}:;,()]) ?/g, '$1')
        .trim();
    expect(normalise(tokensCss)).toBe(normalise(appendix));
  });
});

describe('contrast pairs', () => {
  it('composites a translucent foreground over its backdrop before measuring', () => {
    const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
    const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
    const half = over({ r: 255, g: 255, b: 255, a: 0.5 }, black);
    expect(half.r).toBeCloseTo(127.5, 5);
    expect(half.a).toBe(1);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
  });
});
