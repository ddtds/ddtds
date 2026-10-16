import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [
    solid(),
    ddtPlugin({
      include: ["../../docs/framework/solid/**/*.md", "src/*.tsx"],
      exclude: ["../../docs/framework/solid/ssr/**"],
    }),
  ],
  test: {
    dir: "./tests",
    exclude: ["server/**"],
    environment: "happy-dom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
});
