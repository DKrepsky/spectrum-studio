/**
 * Token helpers for the tests (ADR 0015, DESIGN.md 2.18). jsdom neither loads stylesheets nor
 * substitutes `var()`, so tests read `src/styles/tokens.css` as text, take the `:root` declarations
 * and resolve `var()` chains here. Only the top-level `:root` counts (media overrides are ignored).
 */
import { cssRules } from './css';

export type Tokens = Map<string, string>;

/** Custom property declarations of the top-level `:root` rules, later declarations winning. */
export function parseTokens(css: string): Tokens {
  const tokens: Tokens = new Map();
  for (const r of cssRules(css)) {
    if (r.selector !== ':root' || r.within.length > 0) continue;
    for (const declaration of r.body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim();
      if (!name.startsWith('--')) continue;
      tokens.set(name, declaration.slice(colon + 1).trim());
    }
  }
  return tokens;
}

/** The value of a token with every var() reference replaced by its own value. Throws if undefined. */
export function resolveToken(name: string, tokens: Tokens): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`token ${name} is not defined`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolveToken(inner, tokens));
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses `#rgb`, `#rrggbb`, `rgb(r, g, b)` and `rgba(r, g, b, a)` (the forms DESIGN.md 2.4 uses). */
export function toRgba(value: string): Rgba {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const digits = hex[1]!;
    const h = digits.length === 3 ? digits.replace(/./g, (c) => c + c) : digits;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (fn) {
    return {
      r: Number(fn[1]),
      g: Number(fn[2]),
      b: Number(fn[3]),
      a: fn[4] === undefined ? 1 : Number(fn[4]),
    };
  }
  throw new Error(`not a colour this helper reads: ${value}`);
}

/** Composites a (possibly translucent) colour over an opaque one; the result is opaque. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => top.a * t + (1 - top.a) * b;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** WCAG 2.x relative luminance of an opaque colour. */
export function luminance(c: Rgba): number {
  const lin = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG contrast ratio between two opaque colours, 1 to 21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
