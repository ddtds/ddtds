import { defineConfig } from "vitest/config";
import { octane } from "octane/compiler/vite";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [
    // must go first so fences are found
    ddtPlugin({ include: ["../../docs/framework/octane/**/*.md", "src/*.tsx"] }),
    octane({ ssr: false }),
  ],
  test: {
    dir: "./tests",
    environment: "happy-dom",
    setupFiles: ["@testing-library/jest-dom/vitest", "./tests/setup.ts"],
  },
});
