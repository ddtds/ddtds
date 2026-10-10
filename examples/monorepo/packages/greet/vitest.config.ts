import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin({ include: ["../../docs/*.md"] })],
  test: { dir: "./tests", environment: "jsdom" },
});
