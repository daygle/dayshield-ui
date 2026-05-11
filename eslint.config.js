import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  // TypeScript flat/recommended (sets parser, plugin, and TS rules for .ts/.tsx)
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Allow _-prefixed names to be unused (standard TypeScript convention for stubs)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Classic react-hooks rules (rules-of-hooks + exhaustive-deps)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Warn when a file mixes component exports with non-component exports
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Context files intentionally co-locate provider components and hooks in one file
  {
    files: ['src/context/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]
