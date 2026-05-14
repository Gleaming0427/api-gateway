/**
 * ESLint flat config for API Gateway HA.
 * Enforces TypeScript strictness, port/adapter boundaries, and commenting conventions.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Global ignores ──────────────────────────────────────────────────
  {
    ignores: ["dist/", "node_modules/", ".sst/", "*.js", "*.mjs", "*.cjs"],
  },

  // ── Source files ────────────────────────────────────────────────────
  {
    files: ["src/**/*.ts", "sst.config.ts"],
    rules: {
      // No `any` — use `unknown` and narrow (CLAUDE.md: "No any")
      "@typescript-eslint/no-explicit-any": "error",

      // Prefer `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],

      // Unused vars are dead code — but allow `_` prefix for intentional
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      // No non-null assertions unless there's a good reason (use proper narrowing)
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Prefer interface for object shapes (CLAUDE.md: "Prefer interface for public contracts")
      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],

      // Allow console.log and console.error — required for Lambda structured logging
      "no-console": ["warn", { allow: ["error", "warn", "log"] }],

      // Explain why a lint suppression is needed
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],
    },
  },

  // ── Port/adapter boundary — no AWS SDK in core/ ─────────────────────
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@aws-sdk/*", "aws-sdk"],
              message:
                "Do not import AWS SDK in src/core/. Core is runtime-agnostic — inject dependencies via interfaces.",
            },
            {
              group: ["../adapters/*", "../functions/*", "../stacks/*"],
              message:
                "Do not import template code from src/core/. Core ships in the npm package — it must be independent.",
            },
          ],
        },
      ],
    },
  },

  // ── Test files — tests focus on correctness, not strict linting ─────
  {
    files: ["tests/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
