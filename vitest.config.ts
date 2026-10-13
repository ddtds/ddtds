import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  test: {
    // Snapshots of nested Vitest runs and CLI output must not depend on color support
    env: { NO_COLOR: "1" },
    projects: [
      "packages/*",
      "examples/{js,ts,react}",
      "examples/monorepo/packages/*",
      "examples/monorepo/packages/*/vitest.server.config.ts",
      {
        plugins: [ddtPlugin({ include: ["README.md"] })],
        test: { name: "readme", include: ["README.md"], environment: "happy-dom" },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "packages/*/dist/**/*.mjs"],
      exclude: ["**/*.test.ts", "**/*.bench.ts", "**/test-utils.ts"],
    },
  },
});
