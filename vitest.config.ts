import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  test: {
    // Snapshots of nested Vitest runs and CLI output must not depend on color support
    env: { NO_COLOR: "1" },
    projects: [
      "packages/*/vitest.config.ts",
      "examples/vitest/{js,ts,react}",
      "examples/vitest/monorepo/packages/*",
      "examples/vitest/monorepo/packages/*/vitest.server.config.ts",
      {
        plugins: [ddtPlugin({ include: ["packages/core/src/**/*.ts"], exclude: ["**/*.test.ts"] })],
        resolve: {
          alias: [
            {
              find: /^@ddtds\/core$/,
              replacement: fileURLToPath(new URL("packages/core/src/index.ts", import.meta.url)),
            },
          ],
        },
        test: { name: "source docs", include: [], environment: "node" },
      },
      {
        plugins: [ddtPlugin({ include: ["README.md"] })],
        test: { name: "readme", include: ["README.md"], environment: "happy-dom" },
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
