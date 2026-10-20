import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/internal.ts", "src/runtime.ts"],
  exports: {
    customExports(exports, { isPublish }) {
      if (isPublish) delete exports["./internal"];
      return exports;
    },
  },
});
