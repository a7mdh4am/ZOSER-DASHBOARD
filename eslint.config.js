import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

// Same setup as the shop (ZOSER) and app (ZSRApp) projects.
export default defineConfig([
  globalIgnores(["dist"]),
  // Build config runs in Node.
  { files: ["vite.config.js"], languageOptions: { globals: globals.node } },
  {
    files: ["**/*.{js,jsx}"],
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
      // useApiData(load, deps) takes deps like useEffect; check them the same way.
      "react-hooks/exhaustive-deps": [
        "warn",
        { additionalHooks: "(useApiData)" },
      ],
    },
  },
]);
