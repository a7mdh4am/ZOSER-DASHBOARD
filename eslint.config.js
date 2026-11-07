import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Same setup as the shop (ZOSER) and app (ZSRApp) projects.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // The two context files export their provider and its hook together.
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true, // the vite preset's options, kept
        allowCompoundComponents: true,
        allowExportNames: ['useAuth', 'useToast'],
      }],
    },
  },
])
