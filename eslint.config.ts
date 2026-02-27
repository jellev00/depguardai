import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";

export default defineConfig([
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true,
      },
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
]);