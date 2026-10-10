import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [solid(), ddtPlugin({ include: ["../../docs/framework/solid/**/*.md"] })],
  test: { dir: "./tests", environment: "happy-dom" },
});
