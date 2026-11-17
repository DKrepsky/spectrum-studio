import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Boundary of the presentational layer (ADR 0015 section 2, plan 6). `src/ui/` may import React,
 * other `src/ui/` modules, `src/format/` and CSS. It must not reach app state, IPC, bindings, the
 * plot, the feature components, Tauri or zustand, not even as a type, a dynamic import or a mock.
 * ESLint enforces the static imports too (eslint.config.js); this test also covers what lint
 * misses and keeps formatting out of the components (DESIGN.md 7.5).
 */

const UI = resolve(__dirname);
const SRC = resolve(UI, '..');

/** Folder names a relative import may not pass through, from anywhere under `src/ui/`. */
const FORBIDDEN_SEGMENTS = ['ipc', 'state', 'bindings', 'plot', 'components'];
/** Package specifiers a `src/ui/` file may not use. */
const FORBIDDEN_PACKAGES = ['@tauri-apps/', 'zustand'];
/** Formatting that must go through `src/format/`. */
const FORBIDDEN_FORMATTING = /\.to(?:Fixed|LocaleString)\s*\(/;

/** Module specifiers named by a file: static, re-export, dynamic, side-effect, mock and require. */
function specifiersOf(text: string): string[] {
  const patterns = [
    /\bfrom\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"\n]+)['"]/g,
    /\b(?:vi\.)?(?:mock|doMock|unmock|doUnmock|importActual)\s*\(\s*['"]([^'"\n]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]/g,
  ];
  return patterns.flatMap((p) => [...text.matchAll(p)].map((m) => m[1]!));
}

/** Why a specifier is not allowed in `src/ui/`, or null when it is allowed. */
function forbiddenReason(specifier: string): string | null {
  if (
    FORBIDDEN_PACKAGES.some((p) => specifier === p.replace(/\/$/, '') || specifier.startsWith(p))
  ) {
    return `package ${specifier}`;
  }
  if (specifier.startsWith('.')) {
    const hit = specifier.split('/').find((segment) => FORBIDDEN_SEGMENTS.includes(segment));
    if (hit) return `path through "${hit}"`;
  }
  return null;
}

/** Every boundary violation in one file's text, as readable findings. */
function violationsIn(text: string): string[] {
  const found = specifiersOf(text).flatMap((s) => {
    const reason = forbiddenReason(s);
    return reason ? [`imports ${reason}`] : [];
  });
  if (FORBIDDEN_FORMATTING.test(text)) found.push('formats with toFixed or toLocaleString');
  return found;
}

/**
 * Feature code (everything under `src/` outside `src/ui/`) reaches the ui only through a folder's
 * index: `../ui/Field`, `../ui/Popover`. Internals (`ui/hooks/...`, `ui/Popover/ListRow`) are not
 * public, and the old feature hook paths are gone. Returns the specifiers that break that rule.
 */
function uiInternalImports(fileFromSrc: string, text: string): string[] {
  const from = resolve(SRC, dirname(fileFromSrc));
  const posix = (path: string) => relative(SRC, path).split('\\').join('/');
  return specifiersOf(text).filter((specifier) => {
    if (!specifier.startsWith('.')) return false;
    const target = resolve(from, specifier);
    if (posix(target).startsWith('components/source/use')) return true; // old feature hook paths
    const inUi = relative(UI, target).split('\\').join('/');
    if (inUi.startsWith('..')) return false; // not under src/ui/
    return !/^(?:[A-Za-z]+(?:\/index)?)?$/.test(inUi); // src/ui/<Folder> or its index only
  });
}

/** Every file under `src/ui/` (tests included), with its path relative to `src/ui/`. */
function uiFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return uiFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(name) ? [relative(UI, path)] : [];
  });
}

/** Every non-ui source file under `src/`, relative to `src/`. */
function featureFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === UI ? [] : featureFiles(path);
    return /\.(?:ts|tsx)$/.test(name) ? [relative(SRC, path).split('\\').join('/')] : [];
  });
}

describe('feature code uses the ui through its public folders', () => {
  it('imports no ui internal and no old feature hook path, in any feature file', () => {
    const offenders = featureFiles(SRC).flatMap((file) =>
      uiInternalImports(file, readFileSync(join(SRC, file), 'utf8')).map(
        (spec) => `${file} imports ${spec}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('detects an internal ui import, an old feature hook path, and accepts a folder index', () => {
    const internal = ['import { listItems } from "../../', 'ui/hooks/useListKeys";'].join('');
    expect(uiInternalImports('components/source/SourceMenu.tsx', internal)).toEqual([
      '../../ui/hooks/useListKeys',
    ]);
    const deep = ['import { ListRow } from "../../', 'ui/Popover/ListRow";'].join('');
    expect(uiInternalImports('components/source/SourceMenu.tsx', deep)).toEqual([
      '../../ui/Popover/ListRow',
    ]);
    const oldHook = ['import { useMenuKeys } from "./', 'useMenuKeys";'].join('');
    expect(uiInternalImports('components/source/SourceMenu.tsx', oldHook)).toEqual([
      './useMenuKeys',
    ]);
    const index = ['import { Field } from "../', 'ui/Field";'].join('');
    expect(uiInternalImports('components/ParamForm.tsx', index)).toEqual([]);
  });
});

describe('src/ui boundary', () => {
  it('has no forbidden import, dynamic import, mock or formatting call in any file', () => {
    const offenders = uiFiles(UI).flatMap((file) => {
      const text = readFileSync(join(UI, file), 'utf8');
      // This file names the forbidden things on purpose (in the self-check below), so its own
      // text is checked only through the self-check.
      if (file === 'boundary.test.ts') return [];
      return violationsIn(text).map((v) => `${file}: ${v}`);
    });
    expect(offenders).toEqual([]);
  });

  it('detects every kind of forbidden reference (self-check of the scanner)', () => {
    // Fixtures are assembled at run time so that this file does not contain them literally.
    const cases: [string, string][] = [
      ['static import of state', ['import { s } from "../', 'state/store";'].join('')],
      ['import of ipc under src/ui', ['import { x } from "../../', 'ipc/commands";'].join('')],
      ['type import of bindings', ['import type { A } from "../../', 'bindings/A";'].join('')],
      ['dynamic import of plot', ['const m = await import("../../', 'plot/theme");'].join('')],
      ['Tauri package', ['import { invoke } from "@', 'tauri-apps/api/core";'].join('')],
      ['zustand', ['import { create } from "', 'zustand";'].join('')],
      ['mock of components', ['vi.mock("../../', 'components/App");'].join('')],
      ['re-export of plot', ['export * from "../../', 'plot/theme";'].join('')],
      ['formatting', ['const t = n.', 'toFixed', '(2);'].join('')],
    ];
    for (const [name, text] of cases) {
      expect(violationsIn(text), name).not.toEqual([]);
    }
    const allowed = [
      'import { useState } from "react";',
      'import { formatFrequency } from "../../format/frequency";',
      'import { Button } from "../Button";',
      'import "./Button.css";',
    ];
    for (const text of allowed) {
      expect(violationsIn(text), text).toEqual([]);
    }
  });
});
