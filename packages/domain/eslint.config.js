import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // The domain must stay pure: no framework, database, network or browser imports.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*', 'typeorm', 'pg', 'next', 'next/*', 'react', 'react-dom', 'node:*', 'fs', 'path', 'http', 'https', 'net', 'child_process'], message: 'packages/domain must remain pure TypeScript.' },
          ],
        },
      ],
    },
  },
);
