// ponytail: expo's default flat config, nothing custom. Add rules when a real lint disagreement shows up.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["node_modules", ".expo", "dist"] },
]);
