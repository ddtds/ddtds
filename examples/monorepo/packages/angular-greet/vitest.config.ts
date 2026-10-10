import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import angular from "@analogjs/vite-plugin-angular";
import { ddtPlugin } from "@ddtds/vitest";

export default defineConfig({
  plugins: [
    angular({ tsconfig: fileURLToPath(new URL("tsconfig.json", import.meta.url)) }),
    ddtPlugin({ include: ["../../docs/framework/angular/**/*.md"] }),
  ],
  test: { dir: "./tests", environment: "jsdom", setupFiles: ["@angular/compiler"] },
});
