import { defineConfig } from "vitest/config";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [ddtPlugin({ include: ["../../docs/framework/angular/**/*.md"] })],
  test: { dir: "./tests", environment: "jsdom" },
});
