import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "examples/{js,ts,react}", "examples/monorepo/packages/*"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.bench.ts", "**/test-utils.ts"],
    },
  },
});
