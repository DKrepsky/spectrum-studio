import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'target',
      'src-tauri',
      'crates',
      'src/bindings',
      'e2e',
      'node_modules',
      '.claude/team/work/**/evidence/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      // With `noUncheckedIndexedAccess`, indexing typed arrays in numeric loops yields
      // `number | undefined`; `!` after a bounds-checked index is the clearest idiom there.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // ADR 0015: src/ui/ is presentational. It never reaches app state, IPC, bindings, the plot,
    // the feature components, Tauri or zustand (tests included). src/ui/boundary.test.ts checks too.
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/ipc',
                '**/ipc/**',
                '**/state',
                '**/state/**',
                '**/bindings',
                '**/bindings/**',
                '**/plot',
                '**/plot/**',
                '**/components',
                '**/components/**',
                '@tauri-apps/*',
                'zustand',
                'zustand/*',
              ],
              message:
                'src/ui/ is presentational (ADR 0015): no app state, IPC, bindings, plot or feature components.',
            },
          ],
        },
      ],
    },
  },
  {
    // Feature code (outside src/ui/) uses the ui through a folder's index (`../ui/Field`), never its
    // internals or the old hook paths. src/ui/boundary.test.ts checks the same rule.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui/hooks', '**/ui/hooks/**', '**/ui/*/*', '**/components/source/use*'],
              message:
                'Import the ui through its folder index (e.g. ../ui/Popover), not its internals (ADR 0015).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
