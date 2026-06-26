// ponytail: expo's default flat config, nothing custom. Add rules when a real lint disagreement shows up.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["node_modules", ".expo", "dist"] },
  {
    // Tests/mocks run under Jest; expo's flat config registers describe/it/expect
    // but not the `jest` object itself.
    files: ["src/__tests__/**", "__mocks__/**", "jest-setup.js"],
    languageOptions: { globals: { jest: "readonly" } },
    // Jest's mock hoisting requires `require()` and imports placed after the
    // jest.mock() calls — both are necessary in test files, not style slips.
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
  {
    // react-hooks v6's compiler-aware rules misfire on RN's animation APIs:
    // Animated.Value is read during render to build interpolations, and Reanimated
    // shared values are mutated by design. Both are correct, idiomatic usage here.
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
