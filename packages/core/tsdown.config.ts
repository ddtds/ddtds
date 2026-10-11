import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", log: "src/logger.ts" },
});
