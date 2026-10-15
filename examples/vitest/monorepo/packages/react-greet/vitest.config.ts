import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [react(), ddtPlugin({ include: ["../../docs/framework/react/**/*.md"] })],
  test: { dir: "./tests", environment: "happy-dom" },
});
