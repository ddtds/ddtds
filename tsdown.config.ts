import { defineConfig } from "tsdown";

/**
 * Builds every published package to ESM in `dist`. `exports` keeps an `@ddtds/source` condition
 * pointing at `src`, so typecheck and editors in this repo use source without a build, while
 * tests, examples and installs resolve the built files.
 */
export default defineConfig({
  workspace: "packages/*",
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  unbundle: true,
  dts: true,
  sourcemap: true,
  clean: true,
  exports: { devExports: "@ddtds/source" },
  publint: "ci-only",
  attw: { enabled: "ci-only", profile: "esm-only", level: "error" },
  unused: true,
  failOnWarn: true,
});
