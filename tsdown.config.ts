import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: "packages/*",
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  unbundle: true,
  dts: true,
  sourcemap: true,
  clean: true,
  // editor uses ts files instead of built .d.ts
  exports: { devExports: "@ddtds/source" },
  unused: true,
  failOnWarn: true,
});
