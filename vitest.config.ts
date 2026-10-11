import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Snapshots of nested Vitest runs and CLI output must not depend on color support
    env: { NO_COLOR: "1" },
    projects: ["packages/*", "examples/{js,ts,react}", "examples/monorepo/packages/*"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "packages/*/dist/**/*.mjs"],
      exclude: ["**/*.test.ts", "**/*.bench.ts", "**/test-utils.ts"],
    },
  },
});
