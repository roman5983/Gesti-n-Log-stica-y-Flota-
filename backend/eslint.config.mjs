import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint (flat config). Baseline scope:
 *  - @typescript-eslint "recommended" (syntactic, no type-checking) — fast.
 *  - no-console as a warning: the few intentional console.* calls
 *    (bootstrap logs, dev mailer) carry an eslint-disable comment.
 *
 * Prisma's generated client is not linted.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-console': 'warn',
      // The codebase marks deliberately-unused params/vars/catches with a
      // leading underscore (e.g. `_next` in Express error handlers).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
