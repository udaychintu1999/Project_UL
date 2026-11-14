// Start with high-signal, low-noise checks so accepted P01 authentication code
// isn't rewritten merely to satisfy a new linting configuration.
// This config does not enable type-aware rules; TypeScript remains the type gate.
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.dart_tool/**',
      '**/coverage/**',
      '**/.gradle/**',
      '**/local-dynamodb-data/**',
    ],
  },
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/tests/unit/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-debugger': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-constant-binary-expression': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-debugger': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-constant-binary-expression': 'error',
    },
  },
];
