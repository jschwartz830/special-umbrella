import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Hooks called conditionally break React at runtime — always an error.
      'react-hooks/rules-of-hooks': 'error',
      // Missing effect deps are often intentional here; surface them without failing CI.
      'react-hooks/exhaustive-deps': 'warn',
      // tsc (noUnusedLocals/Parameters) already enforces this.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
