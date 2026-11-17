/**
 * Minimal CSS reader for the contract tests. It understands nested at-rules (`@layer`, `@media`,
 * `@supports`), so a rule inside `@layer base { ... }` is found like any other.
 * Not a CSS parser: no strings with braces, no escapes. Enough for the files in `src/styles/`.
 */

export interface CssRule {
  /** Whitespace-normalised selector list, e.g. `.capture-main, .capture-chevron`. */
  selector: string;
  /** Declarations of the rule itself (nested rules excluded), whitespace-normalised. */
  body: string;
  /** The at-rules it sits in, outermost first (`@layer base`, `@media (...)`). */
  within: string[];
}

/** Every style rule of a stylesheet in source order, at-rule containers excluded. */
export function cssRules(source: string): CssRule[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const stack: { header: string; body: string; rule: boolean }[] = [];
  let buffer = '';
  for (const char of code) {
    if (char === '{') {
      const header = buffer.replace(/\s+/g, ' ').trim();
      stack.push({ header, body: '', rule: !header.startsWith('@') });
      buffer = '';
    } else if (char === '}') {
      const block = stack.pop();
      if (!block) throw new Error('unbalanced } in stylesheet');
      if (block.rule) {
        const within = stack.filter((s) => s.header.startsWith('@')).map((s) => s.header);
        rules.push({ selector: block.header, body: buffer.replace(/\s+/g, ' ').trim(), within });
      }
      buffer = '';
    } else if (char === ';' && buffer.trim().startsWith('@')) {
      // A statement at-rule such as `@layer base;` has no block and no body.
      buffer = '';
    } else {
      buffer += char;
    }
  }
  if (stack.length > 0) throw new Error('unbalanced { in stylesheet');
  return rules;
}

/**
 * Declarations of the first style rule whose selector list (whitespace-normalised) is `selector`.
 * Throws when there is none, so a renamed selector fails the test instead of passing vacuously.
 */
export function rule(source: string, selector: string): string {
  const wanted = selector.replace(/\s+/g, ' ').trim();
  const found = cssRules(source).find((r) => r.selector === wanted);
  if (!found) throw new Error(`no rule for ${selector}`);
  return found.body;
}
