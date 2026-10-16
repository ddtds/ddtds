import { defineConfig } from "vitest/config";
import { preact } from "@preact/preset-vite";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [preact(), ddtPlugin({ include: ["../../docs/framework/preact/**/*.md"] })],
  test: { dir: "./tests", environment: "happy-dom" },
});
