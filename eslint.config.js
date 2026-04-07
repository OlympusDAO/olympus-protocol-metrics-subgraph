const globals = require("globals");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const simpleImportSort = require("eslint-plugin-simple-import-sort");

module.exports = [
  {
    ignores: ["**/generated/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
      globals: {
        ...globals.es6,
        describe: false,
        it: false,
        expect: false,
        u64: false,
        i64: false,
        unreachable: false,
        unmanaged: false,
        idof: false,
        changetype: false,
        memory: false,
        load: false,
        store: false,
        __alloc: false,
        __release: false,
        __retain: false,
      },
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      curly: ["warn", "multi-line", "consistent"],
      "no-console": ["warn", { allow: ["error", "info", "warn"] }],
      "no-param-reassign": "warn",
      "no-shadow": "warn",
      "prefer-const": "warn",
      "spaced-comment": ["warn", "always", { line: { markers: ["/ <reference"] } }],
      "simple-import-sort/imports": "warn",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/ban-ts-ignore": "off",
      "@typescript-eslint/explicit-function-return-type": ["warn", { allowExpressions: true }],
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-use-before-define": "warn",
    },
  },
  {
    files: ["**/tests/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
