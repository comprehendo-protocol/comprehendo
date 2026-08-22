// @ts-check
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default defineConfig(
  {
    ignores: ['dist/**', 'eslint.config.js', 'vitest.config.ts'],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // The compiler's noUnusedLocals/noUnusedParameters already catch plain
      // unused bindings; this plugin additionally catches unused imports
      // specifically and can autofix them, which tsc cannot.
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
);
