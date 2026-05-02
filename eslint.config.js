// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "bun.lock",
      "test/fixtures/**",
      "test/tools/**",
      "*.bin",
      "docs/**",
      ".sisyphus/",
      ".serena/",
    ],
  },

  ...tseslint.configs.recommended,

  prettier,

  {
    files: ["packages/**/*.ts", "apps/server/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression > MemberExpression[object.name='document'][property.name='innerHTML']",
          message:
            "Direct innerHTML assignment is forbidden. Use React state or dangerouslySetInnerHTML with a comment opt-out.",
        },
      ],
    },
  },

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
