import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { ComponentType } from 'react';

import { render } from '@testing-library/react';
import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import axe, { type Result } from 'axe-core';

import * as projectAnnotations from '../../.storybook/preview';

/**
 * Storybook is the catalogue of `src/ui/` (ADR 0016, DESIGN.md 10.2 rule 7). These guards run in
 * `npm test`, so `npm run check` fails when a component ships without stories or a story throws.
 * `npm run build-storybook` is not part of the check (it takes tens of seconds).
 */

setProjectAnnotations(projectAnnotations);

const UI = resolve(__dirname);
const SRC = resolve(UI, '..');
const REPO = resolve(SRC, '..');

/**
 * Every `*.stories.tsx` file under `src/`, found on disk at run time. `import.meta.glob` is not used:
 * Vitest's file-system module cache keeps the glob's result for an unchanged test file, so a new or
 * removed stories file would go unnoticed until the test file itself changed.
 */
function storyFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return storyFilesUnder(path);
    return /\.stories\.tsx$/.test(name) ? [path] : [];
  });
}

const storyPaths = storyFilesUnder(SRC);
const modules: Record<string, Record<string, unknown>> = Object.fromEntries(
  await Promise.all(
    storyPaths.map(async (path): Promise<[string, Record<string, unknown>]> => {
      const mod: unknown = await import(/* @vite-ignore */ path);
      return [relative(REPO, path).split('\\').join('/'), mod as Record<string, unknown>];
    }),
  ),
);

/** Component folders of `src/ui/`: a folder with an `index.ts` is a component (hooks is not). */
function componentFolders(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .filter((name) => existsSync(join(dir, name, 'index.ts')))
    .sort();
}

/** The folders that have no `<Folder>/<Folder>.stories.tsx`, given the stories file paths. */
export function missingStories(
  folders: readonly string[],
  storyFiles: readonly string[],
): string[] {
  return folders.filter((folder) => !storyFiles.includes(`src/ui/${folder}/${folder}.stories.tsx`));
}

/** Storybook imports a file names: the packages and any `.stories` module. */
const STORYBOOK = /^(?:storybook(?:\/|$)|@storybook\/)/;
export function storybookImports(text: string): string[] {
  const patterns = [
    /\bfrom\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"\n]+)['"]/g,
  ];
  return patterns
    .flatMap((p) => [...text.matchAll(p)].map((m) => m[1]!))
    .filter((specifier) => STORYBOOK.test(specifier) || /\.stories(?:\.|\/|$)/.test(specifier));
}

/** Every source file under `dir` that the app can load (not stories, not tests, not `src/test`). */
function appFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === join(SRC, 'test') ? [] : appFiles(path);
    if (/\.stories\.tsx$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return /\.(?:ts|tsx)$/.test(name) ? [path] : [];
  });
}

const storyFiles = Object.keys(modules);

describe('every src/ui component ships with stories', () => {
  it('has a stories file in every component folder, and says which folder lacks one', () => {
    const missing = missingStories(componentFolders(UI), storyFiles);
    expect(missing, `no <Folder>/<Folder>.stories.tsx for: ${missing.join(', ')}`).toEqual([]);
  });

  it('names the folder when its stories file is missing (self-check)', () => {
    const files = ['src/ui/Button/Button.stories.tsx'];
    expect(missingStories(['Button', 'Dialog'], files)).toEqual(['Dialog']);
    expect(missingStories(['Button'], files)).toEqual([]);
    // A stories file in the wrong folder does not count.
    expect(missingStories(['Dialog'], ['src/ui/Button/Dialog.stories.tsx'])).toEqual(['Dialog']);
  });

  it('finds every component folder that exists (self-check: hooks is not a component)', () => {
    const folders = componentFolders(UI);
    expect(folders).toContain('Button');
    expect(folders).not.toContain('hooks');
  });
});

/** A composed story: a component that can run its own play function on a canvas. */
type ComposedStory = ComponentType & {
  play?: (context: { canvasElement: HTMLElement }) => Promise<void>;
  parameters?: { a11y?: A11yParameters };
};

describe('every stories module is a valid CSF file with at least one story', () => {
  it.each(Object.keys(modules))('%s', (path) => {
    const mod = modules[path] as { default?: { title?: unknown } } & Record<string, unknown>;
    expect(typeof mod.default?.title).toBe('string');
    const stories = Object.keys(mod).filter((key) => key !== 'default');
    expect(stories.length).toBeGreaterThan(0);
  });
});

/**
 * The accessibility check of the addon (`@storybook/addon-a11y`, ADR 0016), run here with the same
 * engine in every story. The addon's `region` rule is off as well: a component story has no
 * landmarks. jsdom does not lay out, so `color-contrast` reports "incomplete", not violations; the
 * contrast pairs are guarded by the token tests (DESIGN.md 9.3, 9.4). A story can narrow the
 * rules with `parameters.a11y.config.rules` (as in the addon) and must say why in a comment there.
 */
const A11Y_DEFAULT_RULES = [{ id: 'region', enabled: false }];

interface A11yParameters {
  disable?: boolean;
  test?: 'off' | 'todo' | 'error';
  config?: { rules?: { id: string; enabled: boolean }[] };
}

/** Violations of the story's rendered page, as text a failure message can show. */
async function accessibilityViolations(
  parameters: { a11y?: A11yParameters } | undefined,
): Promise<string[]> {
  const a11y = parameters?.a11y;
  if (a11y?.disable || a11y?.test === 'off') return [];
  const rules = [...A11Y_DEFAULT_RULES, ...(a11y?.config?.rules ?? [])];
  const result: Result[] = await axe
    .run(document.body, {
      rules: Object.fromEntries(rules.map((rule) => [rule.id, { enabled: rule.enabled }])),
    })
    .then((r) => r.violations);
  return result.map(
    (v) =>
      `${v.id} (${v.impact ?? 'impact unknown'}): ${v.help}; ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

describe('the accessibility check finds a planted violation (self-check)', () => {
  it('reports an image without alt text, and a story that opts out is not checked', async () => {
    const { unmount } = render(<img src="planted.png" />);
    try {
      const found = await accessibilityViolations({});
      expect(found.some((v) => v.startsWith('image-alt'))).toBe(true);
      expect(await accessibilityViolations({ a11y: { disable: true } })).toEqual([]);
    } finally {
      unmount();
    }
  });
});

describe('every story renders and runs its play function', () => {
  const cases = Object.entries(modules).flatMap(([path, mod]) => {
    const composed = composeStories(mod as Parameters<typeof composeStories>[0]);
    return Object.entries(composed as Record<string, ComposedStory>).map(([name, Story]) => ({
      name: `${path} ${name}`,
      Story,
    }));
  });

  it('finds stories to test', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c) => [c.name, c.Story] as const))('%s', async (_name, Story) => {
    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    const { container, unmount } = render(<Story />);
    try {
      // Portals (Dialog) render into document.body beside the test container.
      const rendered = container.childNodes.length > 0 || document.body.childElementCount > 1;
      expect(rendered).toBe(true);
      await Story.play?.({ canvasElement: container });
      expect(errors).toEqual([]);
      expect(await accessibilityViolations(Story.parameters)).toEqual([]);
    } finally {
      unmount();
    }
  });
});

describe('Storybook stays out of the app', () => {
  it('no app file imports Storybook or a stories module', () => {
    const offenders = appFiles(SRC).flatMap((file) =>
      storybookImports(readFileSync(file, 'utf8')).map(
        (spec) => `${relative(REPO, file)} imports ${spec}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('detects a Storybook import in app code (self-check)', () => {
    expect(storybookImports("import { expect } from 'vitest';")).toEqual([]);
    expect(storybookImports("import { fn } from 'storybook/test';")).toEqual(['storybook/test']);
    expect(storybookImports(`import type { Meta } from "@storybook/react-vite";`)).toEqual([
      '@storybook/react-vite',
    ]);
    expect(storybookImports("const x = await import('../ui/Button/Button.stories');")).toEqual([
      '../ui/Button/Button.stories',
    ]);
    expect(storybookImports("import { Button } from '../ui/Button';")).toEqual([]);
  });
});
