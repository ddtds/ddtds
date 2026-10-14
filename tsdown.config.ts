import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: "packages/*",
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  unbundle: true,
  dts: true,
  sourcemap: false,
  clean: true,
  // editor uses ts files instead of built .d.ts
  exports: { devExports: "@ddtds/source" },
  attw: { profile: "esm-only", level: "error" },
  unused: true,
  failOnWarn: true,
});
