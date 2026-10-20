import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/docs/session.ts",
    docs: "src/docs/docs.ts",
    config: "src/config.ts",
    fences: "src/fences/blocks.ts",
    errors: "src/fences/compile-error.ts",
    log: "src/log-level.ts",
    codegen: "src/codegen/modules.ts",
    runtime: "src/runtime.ts",
  },
});
