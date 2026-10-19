import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin({ include: ["src/codegen/static-import.ts"] })],
  test: { environment: "node" },
});
