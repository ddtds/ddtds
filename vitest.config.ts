import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  test: {
    // Snapshots of nested Vitest runs and CLI output must not depend on color support
    env: { NO_COLOR: "1" },
    projects: [
      "packages/*/vitest.config.ts",
      "test-utils/vitest.config.ts",
      "examples/vitest/{js,ts,react}",
      "examples/vitest/monorepo/packages/*",
      "!examples/vitest/monorepo/packages/angular-greet",
      "examples/vitest/monorepo/packages/*/vitest.server.config.ts",
      {
        plugins: [ddtPlugin({ include: ["README.md"] })],
        test: { name: "readme", include: ["README.md"], environment: "happy-dom" },
      },
      {
        plugins: [ddtPlugin({ include: ["packages/vitest/README.md"] })],
        test: { name: "vitest-readme", include: ["packages/vitest/README.md"] },
      },
    ],
    coverage: {
      provider: "v8",
      autoAttachSubprocess: true,
      include: ["packages/*/src/**/*.ts", "packages/*/dist/**/*.mjs"],
      exclude: ["**/*.test.ts", "**/*.bench.ts", "**/test-utils.ts", "**/e2e.ts", "**/reporter.ts"],
    },
  },
});
