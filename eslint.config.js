import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const typescriptRecommended = [
  js.configs.recommended,
  tseslint.configs.recommended,
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      ...typescriptRecommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['server/**/*.ts', 'vite.config.ts'],
    extends: typescriptRecommended,
    languageOptions: {
      globals: globals.node,
    },
  },
])
