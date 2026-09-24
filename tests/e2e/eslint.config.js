import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['test-results/**', 'playwright-report/**', 'screenshots/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
