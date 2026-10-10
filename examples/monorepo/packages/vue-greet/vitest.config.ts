import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [vue(), ddtPlugin({ include: ["../../docs/framework/vue/**/*.md"] })],
  test: { dir: "./tests", environment: "jsdom" },
});
