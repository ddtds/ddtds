import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin({ include: ["src/**/*.ts"], exclude: ["**/*.test.ts"] })],
  resolve: { conditions: ["@ddtds/source"] },
  test: { environment: "node" },
});
