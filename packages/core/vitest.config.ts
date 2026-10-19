import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin({ include: ["src/codegen/static-import.ts"] })],
  resolve: {
    alias: {
      "@ddtds/core/runtime": import.meta.dirname + "/src/runtime.ts",
      "@ddtds/core": import.meta.dirname + "/src/index.ts",
    },
  },
  test: { environment: "node" },
});
