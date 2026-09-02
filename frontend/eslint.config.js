import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * ESLint (flat config). Scoped intentionally to a useful baseline:
 *  - @typescript-eslint "recommended" (syntactic, no type-checking) — fast.
 *  - react-hooks: only the two classic rules (rules-of-hooks + exhaustive-deps).
 *    They catch the stale-closure bugs the code review flagged. The full
 *    react-hooks v7 "recommended" set (React Compiler rules) is deliberately
 *    left out for now — it is a much larger, separate cleanup.
 *  - react-refresh: keeps components fast-refreshable under Vite.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Config and test files run in Node; Vitest configs use a triple-slash ref.
    files: ['*.{js,ts}', '**/*.test.{ts,tsx}', 'src/setupTests.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
);
