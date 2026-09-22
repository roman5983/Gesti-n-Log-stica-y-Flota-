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
 *    exhaustive-deps is an *error*, not a warning: a warning can be ignored and
 *    a stale closure ship anyway. A dependency left out on purpose must be
 *    justified with an explicit eslint-disable comment next to it.
 *  - react-refresh: keeps components fast-refreshable under Vite.
 *  - Dates: `new Date(x).toLocale*String()` is banned outside utils/datetime.ts.
 *    Rendering dates by hand is how the "one day off" bug got in (a @db.Date
 *    read in local time); every date goes through formatDateOnly /
 *    formatDateTime / formatLocalDate, which make the choice explicit.
 */

const RAW_DATE_FORMATTING = {
  selector:
    "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/][callee.object.type='NewExpression'][callee.object.callee.name='Date']",
  message:
    'Formateá fechas con utils/datetime (formatDateOnly para @db.Date, formatDateTime / formatLocalDate para instantes).',
};
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
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': ['error', RAW_DATE_FORMATTING],
    },
  },
  {
    // The one place allowed to call toLocale*String on a Date.
    files: ['src/utils/datetime.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Config and test files run in Node; Vitest configs use a triple-slash ref.
    files: ['*.{js,ts}', '**/*.test.{ts,tsx}', 'src/setupTests.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
);
