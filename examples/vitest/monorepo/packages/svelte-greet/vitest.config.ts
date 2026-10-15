import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [svelte(), ddtPlugin({ include: ["../../docs/framework/svelte/**/*.md"] })],
  resolve: { conditions: ["browser"] },
  test: { dir: "./tests", environment: "happy-dom" },
});
