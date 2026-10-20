import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    adapter: "src/adapter.ts",
    runtime: "src/runtime.ts",
  },
});
