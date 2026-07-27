import fs from "node:fs";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import checkFile from "eslint-plugin-check-file";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

const featureRootPath = fileURLToPath(new URL("./src/features", import.meta.url));
const featureDirectories = fs.existsSync(featureRootPath)
  ? fs
      .readdirSync(featureRootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const crossFeatureZones = featureDirectories.map((featureName) => ({
  target: `./src/features/${featureName}`,
  from: "./src/features",
  except: [`./${featureName}`],
}));

const sharedLayerTargets = [
  "./src/assets",
  "./src/components",
  "./src/config",
  "./src/hooks",
  "./src/lib",
  "./src/stores",
  "./src/testing",
  "./src/types",
  "./src/utils",
];

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react,
      import: importPlugin,
      "jsx-a11y": jsxA11y,
      "simple-import-sort": simpleImportSort,
      "check-file": checkFile,
    },
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: {
          noWarnOnMultipleProjects: true,
          project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "property",
          format: null,
        },
      ],

      "react/button-has-type": ["warn", { button: true, submit: true, reset: false }],
      "react/jsx-boolean-value": ["warn", "never"],
      "react/jsx-no-useless-fragment": "warn",
      "react/jsx-pascal-case": "error",
      "react/no-array-index-key": "warn",
      "react/no-unstable-nested-components": "warn",
      "react/self-closing-comp": "warn",

      "import/first": "warn",
      "import/newline-after-import": "warn",
      "import/no-cycle": "warn",
      "import/no-duplicates": "warn",
      "import/no-mutable-exports": "warn",
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            ...crossFeatureZones,
            {
              target: "./src/features",
              from: "./src/app",
            },
            {
              target: sharedLayerTargets,
              from: ["./src/features", "./src/app"],
            },
          ],
        },
      ],
      "import/no-useless-path-segments": ["warn", { commonjs: true }],
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",

      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/iframe-has-title": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",

      "check-file/filename-naming-convention": [
        "error",
        {
          "src/**/*.{ts,tsx}": "KEBAB_CASE",
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],

      curly: ["warn", "all"],
      eqeqeq: ["warn", "always"],
      "default-case": ["warn", { commentPattern: "^no default$" }],
      "dot-notation": ["warn", { allowKeywords: true }],
      "no-alert": "warn",
      "no-debugger": "warn",
      "no-else-return": ["warn", { allowElseIf: false }],
      "no-lonely-if": "warn",
      "no-new-wrappers": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-throw-literal": "warn",
      "no-unneeded-ternary": ["warn", { defaultAssignment: false }],
      "object-shorthand": ["warn", "always", { avoidQuotes: true, ignoreConstructors: false }],
      "prefer-const": ["warn", { destructuring: "any", ignoreReadBeforeAssign: true }],
      "prefer-template": "warn",
    },
  },
  {
    files: ["src/**/!(__tests__)/*"],
    plugins: {
      "check-file": checkFile,
    },
    rules: {
      "check-file/folder-naming-convention": [
        "error",
        {
          "**/*": "KEBAB_CASE",
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
      "simple-import-sort/imports": "off",
      "simple-import-sort/exports": "off",
      "react/button-has-type": "off",
      "jsx-a11y/alt-text": "off",
      "jsx-a11y/anchor-is-valid": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/iframe-has-title": "off",
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-static-element-interactions": "off",
    },
  },
  {
    files: ["src/testing/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  prettier,
]);
