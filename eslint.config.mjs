import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js", "**/*.mjs", "**/*.d.ts"],
  },
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    files: ["**/*.ts"],
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "padding-line-between-statements": [
        "error",
        // Require blank line after variable declarations
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        // Require no blank line between consecutive variable declarations
        { blankLine: "never", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
        // Require blank line before return and continue statements
        { blankLine: "always", prev: "*", next: ["return", "continue"] },
        // Require blank line after import statements
        { blankLine: "always", prev: "import", next: "*" },
        // Allow no blank line between consecutive imports
        { blankLine: "any", prev: "import", next: "import" },
        // Require blank line before if/for/while/switch/try
        { blankLine: "always", prev: "*", next: ["if", "for", "while", "do", "switch", "try"] },
        // Require blank line after block-like statements
        { blankLine: "always", prev: ["if", "for", "while", "do", "switch", "try"], next: "*" },
      ],
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "**/jest.setup.ts"],
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
