import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

/**
 * CSS wiring. A stylesheet that its component never imports is absent from the built app, and a
 * contract test that reads the file from disk still passes: the capture control had no geometry for
 * this reason (009 T7). So every stylesheet is imported by a component beside it, and stylesheets
 * live only in `src/ui/` (component CSS), `src/styles/` (app CSS) and the feature list below.
 */

const SRC = resolve(__dirname, '..');
const STYLES = 'styles/';
const UI = 'ui/';

/**
 * Feature stylesheets outside `src/ui/` and `src/styles/`, each listed on purpose. A component may
 * import only the stylesheet beside it (or one under `src/styles/`). Add a path here with the reason.
 */
const FEATURE_CSS = [
  // The source dialog's own layout: its notes container, test result box and locked fields.
  'components/source/SourceDialog.css',
  // The source trigger and the source popover's row, toast and form layout (feature markup).
  'components/source/source.css',
  // The parameter group frame, shared by the side panel, the connect form and the dialog.
  'components/ParamForm.css',
];

/** Every file under `dir` as a path relative to `SRC`, with forward slashes. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return [relative(SRC, path).split('\\').join('/')];
  });
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The side-effect import of a stylesheet, exactly as the component writes it. */
const importOf = (file: string) => new RegExp(`^import '\\./${escapeRegExp(file)}';`, 'm');

/** Every stylesheet specifier a file imports (static and side-effect imports). */
function cssSpecifiers(text: string): string[] {
  return [...text.matchAll(/\bimport\s+(?:[^'"\n]*\bfrom\s+)?['"]([^'"\n]+\.css)['"]/g)].map(
    (m) => m[1]!,
  );
}

const all = filesUnder(SRC);
const cssFiles = all.filter((f) => f.endsWith('.css'));
const componentFiles = all.filter(
  (f) => f.startsWith('components/') && /\.(?:ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f),
);

/** The component files that sit beside a stylesheet (same folder, not tests). */
function siblingsOf(css: string): string[] {
  const folder = dirname(css);
  return all.filter((f) => dirname(f) === folder && /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f));
}

describe('CSS is wired to the components that use it', () => {
  it('imports every component stylesheet, exactly, from a component beside it', () => {
    const unwired = cssFiles
      .filter((css) => !css.startsWith(STYLES) && css !== 'tokens.css')
      .filter((css) => {
        const name = basename(css);
        return !siblingsOf(css).some((tsx) =>
          importOf(name).test(readFileSync(join(SRC, tsx), 'utf8')),
        );
      });
    expect(unwired).toEqual([]);
  });

  it('matches the exact file name (self-check: Button.css is not satisfied by SplitButton.css)', () => {
    expect(importOf('Button.css').test("import './SplitButton.css';")).toBe(false);
    expect(importOf('Button.css').test("import './Button.css';")).toBe(true);
    expect(importOf('Button.css').test("import './ButtonX.css';")).toBe(false);
    expect(importOf('Button.css').test("import '../Button/Button.css';")).toBe(false);
  });

  it('lets a component import only the stylesheet beside it, or one under src/styles/', () => {
    const offenders = componentFiles.flatMap((file) => {
      const folder = dirname(file);
      const text = readFileSync(join(SRC, file), 'utf8');
      return cssSpecifiers(text)
        .map((spec) => ({
          spec,
          resolved: relative(SRC, resolve(SRC, folder, spec))
            .split('\\')
            .join('/'),
        }))
        .filter(
          ({ spec, resolved }) =>
            !(spec.startsWith('./') && dirname(resolved) === folder) &&
            !resolved.startsWith(STYLES),
        )
        .map(({ spec }) => `${file} imports ${spec}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps stylesheets out of src/ outside src/ui/, src/styles/ and the feature list', () => {
    const stray = cssFiles.filter(
      (css) => !css.startsWith(UI) && !css.startsWith(STYLES) && !FEATURE_CSS.includes(css),
    );
    expect(stray).toEqual([]);
    for (const css of FEATURE_CSS) expect(cssFiles, css).toContain(css);
  });

  it('wires each feature stylesheet from its own folder (self-check of the list)', () => {
    for (const css of FEATURE_CSS) {
      const name = basename(css);
      expect(
        siblingsOf(css).some((tsx) => importOf(name).test(readFileSync(join(SRC, tsx), 'utf8'))),
        css,
      ).toBe(true);
    }
  });
});
