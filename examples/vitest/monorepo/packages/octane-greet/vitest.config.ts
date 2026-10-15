import { defineConfig } from "vitest/config";
import { octane } from "octane/compiler/vite";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [
    octane({ ssr: false }),
    ddtPlugin({ include: ["../../docs/framework/octane/**/*.md"] }),
  ],
  test: { dir: "./tests", environment: "happy-dom" },
});
