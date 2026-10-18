import { defineConfig } from "vitest/config";
import { ddtPlugin, defaultGlobals, typedImports, vitestImports } from "@ddtds/vitest";

const importFromPath = typedImports<typeof import("node:path")>("node:path");

export default defineConfig({
  plugins: [
    ddtPlugin({
      globals: [...defaultGlobals, vitestImports("describe"), importFromPath("basename")],
    }),
  ],
  test: { environment: "node" },
});
