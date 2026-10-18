import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [
    svelte(),
    svelteTesting(),
    ddtPlugin({ include: ["../../docs/framework/svelte/**/*.md"] }),
  ],
  test: {
    dir: "./tests",
    environment: "happy-dom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
