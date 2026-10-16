import { defineConfig } from "vitest/config";
import { preact } from "@preact/preset-vite";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [preact(), ddtPlugin({ include: ["../../docs/framework/preact/**/*.md", "src/*.tsx"] })],
  test: {
    dir: "./tests",
    environment: "happy-dom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
